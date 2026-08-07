import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  isUuid,
  isNonCreditingPledgeEventType,
  parsePledgeWebhook,
  type ParsedPledgeDonation,
} from "@/lib/pledge-parse";
import {
  captureHeaders,
  extractPledgeSignature,
  verifyPledgeSignature,
} from "@/lib/pledge-webhook";
import { verifyVoteIntentToken } from "@/lib/vote-intent-token";

// =====================================================================
// POST /api/webhooks/pledge
//
// Pledge.to webhook receiver.
//
// Flow:
//   1.  Read RAW body (never re-stringify before signature check).
//   2.  Extract `Pledgeling-Signature` header, verify HMAC-SHA256 with
//       PLEDGE_WEBHOOK_SECRET. If a secret is configured and the
//       signature is invalid, return 401 (event is still logged).
//   3.  Persist the inbound event into pledge_webhook_events BEFORE
//       processing, so admins can replay/reconcile.
//   4.  Idempotency: pledge_event_id is the dedupe key. If we've seen
//       this event before, return 200 (no-op).
//   5.  Map donation → pet by, in priority order:
//         a. custom field `submission_id` (set on the donation URL)
//         b. pet_submissions.pledge_mapping_key match
//         c. pet_submissions.pledge_widget_id match
//         d. pet_submissions.pledge_campaign_id match
//         e. utm_content (also set on the donation URL)
//       Anything unmapped is flagged for /admin/reconciliation.
//   6.  Hand off the parsed donation + chosen mapping target to the
//       public.process_pledge_donation() function, which applies the
//       donation row, ledger rows, vote totals, entry transition, and
//       webhook event log in one transaction.
//
// We always return 2xx once an event is logged. Pledge retries on
// non-2xx; we don't want retries for parse/mapping problems.
// =====================================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = extractPledgeSignature(request.headers);
  const webhookSecret = env.PLEDGE_WEBHOOK_SECRET;
  const signatureVerified = webhookSecret
    ? verifyPledgeSignature(rawBody, signature)
    : false;
  const headerSnapshot = captureHeaders(request.headers);

  let payload: Record<string, unknown>;
  try {
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    payload = { _parseError: true, _raw: rawBody.slice(0, 2000) };
  }

  if (!webhookSecret) {
    try {
      const admin = createAdminClient();
      await admin.from("pledge_webhook_events").upsert({
        pledge_event_id: typeof payload.id === "string" ? payload.id : null,
        event_type: typeof payload.event === "string" ? payload.event : null,
        signature_verified: false,
        processing_status: "failed",
        error_message: "Webhook secret/API key is not configured",
        raw_payload: payload as never,
        raw_headers: headerSnapshot as never,
      }, { onConflict: "pledge_event_id", ignoreDuplicates: false });
    } catch {
      // best-effort logging; the 503 still needs to go back to the sender.
    }
    return NextResponse.json(
      { ok: false, error: "Webhook secret/API key is not configured" },
      { status: 503 },
    );
  }

  // Refuse unsigned requests when a secret is configured.
  if (!signatureVerified) {
    // Non-secret fingerprint of the secret currently in use, so we can
    // verify (without leaking the value) that the running Lambda has the
    // expected secret baked in. Pledge signs with HMAC-SHA256(api_key,
    // body) → base64; if the fingerprint here doesn't match the first 8
    // chars of what we'd expect, the wrong secret is live.
    const secret = webhookSecret;
    const secretFingerprint =
      secret.length >= 4
        ? `${secret.slice(0, 4)}…${secret.slice(-2)} (len ${secret.length})`
        : `len ${secret.length}`;
    try {
      const admin = createAdminClient();
      await admin.from("pledge_webhook_events").upsert({
        pledge_event_id: typeof payload.id === "string" ? payload.id : null,
        event_type: typeof payload.event === "string" ? payload.event : null,
        signature_verified: false,
        processing_status: "failed",
        error_message: `Invalid signature (secret fingerprint: ${secretFingerprint})`,
        raw_payload: payload as never,
        raw_headers: headerSnapshot as never,
      }, { onConflict: "pledge_event_id", ignoreDuplicates: false });
    } catch {
      // best-effort logging; we still return 401.
    }
    return NextResponse.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const parsed = parsePledgeWebhook(payload);

  // ---- Map to pet ----------------------------------------------------
  let petSubmissionId: string | null = null;
  let matchedIntentId: string | null = null;
  let mapError: string | null = null;
  try {
    const mapped = await mapDonationToPet(admin, parsed);
    petSubmissionId = mapped.petSubmissionId;
    matchedIntentId = mapped.intentId;
  } catch (err) {
    mapError = err instanceof Error ? err.message : String(err);
  }

  // ---- Refuse to process if we can't even identify the donation ------
  if (!parsed.eventId && !parsed.transactionId) {
    const { data: rawEvent } = await admin
      .from("pledge_webhook_events")
      .insert({
        pledge_event_id: null,
        event_type: parsed.eventType,
        signature_verified: signatureVerified,
        processing_status: "failed",
        error_message: "Missing event/transaction id",
        raw_payload: payload as never,
        raw_headers: headerSnapshot as never,
      })
      .select("id")
      .single();
    return NextResponse.json(
      { ok: true, logged: true, rawId: rawEvent?.id },
      { status: 200 },
    );
  }
  if (parsed.amountCents == null || parsed.amountCents < 0) {
    await admin.from("pledge_webhook_events").insert({
      pledge_event_id: parsed.eventId,
      event_type: parsed.eventType,
      signature_verified: signatureVerified,
      processing_status: "failed",
      error_message: "Missing/invalid amount",
      raw_payload: payload as never,
      raw_headers: headerSnapshot as never,
    });
    return NextResponse.json({ ok: true, logged: true }, { status: 200 });
  }
  const eventIdForDb = parsed.eventId ?? parsed.transactionId ?? crypto.randomUUID();

  // Refund-like events should be recorded for audit/reconciliation, but
  // must never inflate votes or dollars raised.
  if (isNonCreditingPledgeEventType(parsed.eventType)) {
    await admin.from("pledge_webhook_events").upsert({
      pledge_event_id: eventIdForDb,
      event_type: parsed.eventType,
      signature_verified: signatureVerified,
      processing_status: "processed",
      error_message: `Ignored non-crediting event type: ${parsed.eventType}`,
      raw_payload: payload as never,
      raw_headers: headerSnapshot as never,
      processed_at: new Date().toISOString(),
    }, { onConflict: "pledge_event_id", ignoreDuplicates: false });
    return NextResponse.json(
      { ok: true, ignored: true, eventId: eventIdForDb, eventType: parsed.eventType },
      { status: 200 },
    );
  }

  const { data: processed, error: processErr } = await admin.rpc(
    "process_pledge_donation",
    {
      p_pledge_event_id: eventIdForDb,
      p_event_type: parsed.eventType,
      p_signature_verified: signatureVerified,
      p_raw_payload: payload as never,
      p_raw_headers: headerSnapshot as never,
      p_pet_submission_id: petSubmissionId,
      p_matched_intent_id: matchedIntentId,
      p_pledge_transaction_id: parsed.transactionId,
      p_pledge_campaign_id: parsed.campaignId,
      p_pledge_widget_id: parsed.widgetId,
      p_pledge_fundraiser_id: parsed.fundraiserId,
      p_pledge_mapping_key: parsed.mappingKey,
      p_donor_name: parsed.donorName,
      p_donor_email: parsed.donorEmail,
      p_amount_cents: parsed.amountCents,
      p_tip_cents: parsed.tipCents,
      p_fee_cents: parsed.feeCents,
      p_currency: parsed.currency,
      p_error_message: mapError,
    },
  );
  if (processErr) {
    await admin.from("pledge_webhook_events").upsert({
      pledge_event_id: eventIdForDb,
      event_type: parsed.eventType,
      signature_verified: signatureVerified,
      processing_status: "failed",
      error_message: processErr.message,
      raw_payload: payload as never,
      raw_headers: headerSnapshot as never,
      processed_at: new Date().toISOString(),
    }, { onConflict: "pledge_event_id", ignoreDuplicates: false });
    return NextResponse.json({ ok: false, error: processErr.message }, { status: 500 });
  }

  const result =
    processed && typeof processed === "object"
      ? (processed as {
          pet_submission_id?: string | null;
          donation_type?: string;
          vote_credits?: number;
          deduped?: boolean;
        })
      : null;

  return NextResponse.json(
    {
      ok: true,
      eventId: eventIdForDb,
      mapped:
        typeof result?.pet_submission_id === "string"
          ? true
          : petSubmissionId !== null,
      votes:
        typeof result?.vote_credits === "number" ? result.vote_credits : 0,
      donationType:
        typeof result?.donation_type === "string"
          ? result.donation_type
          : petSubmissionId
            ? "vote"
            : "unknown",
      deduped: result?.deduped === true,
    },
    { status: 200 },
  );
}

// =====================================================================
// Maps a parsed Pledge donation to a pet. Tries strongest signals first.
// Returns null if nothing matches; the event will be flagged for admin
// reconciliation.
// =====================================================================
async function mapDonationToPet(
  admin: ReturnType<typeof createAdminClient>,
  parsed: ParsedPledgeDonation,
): Promise<{ petSubmissionId: string | null; intentId: string | null }> {
  // 1. Signed intent token → exact per-click match.
  const signedIntent =
    verifyVoteIntentToken(parsed.intentToken) ??
    verifyVoteIntentToken(parsed.mappingKey);
  if (signedIntent) {
    const { data } = await admin
      .from("donation_intents")
      .select("id, pet_submission_id")
      .eq("id", signedIntent.intentId)
      .eq("pet_submission_id", signedIntent.petSubmissionId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data?.pet_submission_id) {
      return {
        petSubmissionId: data.pet_submission_id as string,
        intentId: (data.id as string) ?? null,
      };
    }
  }

  // 2. Custom field `submission_id` → direct UUID match.
  if (isUuid(parsed.customSubmissionId)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.customSubmissionId)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 3. utm_content set to the pet UUID.
  if (isUuid(parsed.utmContent)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.utmContent)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 4. pledge_mapping_key configured by admin.
  if (parsed.mappingKey) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_mapping_key", parsed.mappingKey)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 5. widget_id (per-pet Pledge widget).
  if (parsed.widgetId) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_widget_id", parsed.widgetId)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 6. campaign_id (per-pet Pledge campaign).
  if (parsed.campaignId) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_campaign_id", parsed.campaignId)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 7. Donor-email intent lookup for verified-account flows only. The
  //    secure vote-start route signs a token and also records an intent
  //    under the user's authenticated account. If the token is dropped
  //    by an upstream surface, this remains a verified fallback; we do
  //    not accept anonymous email-only intents anymore.
  //
  //    We look for the most
  //    recent un-consumed donation_intent record for this donor email
  //    that hasn't expired yet. The intent was recorded the moment the
  //    user clicked "Donate to vote" (or submitted their pet) and is
  //    keyed off the email they will use on Pledge.to.
  if (parsed.donorEmail) {
    const normalizedEmail = parsed.donorEmail.toLowerCase().trim();
    const { data } = await admin
      .from("donation_intents")
      .select("id, pet_submission_id")
      .ilike("donor_email", normalizedEmail)
      .not("user_id", "is", null)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.pet_submission_id) {
      return {
        petSubmissionId: data.pet_submission_id as string,
        intentId: (data.id as string) ?? null,
      };
    }
  }

  return { petSubmissionId: null, intentId: null };
}
