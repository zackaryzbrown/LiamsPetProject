import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  classifyDonationType,
  isUuid,
  parsePledgeWebhook,
  votesFromAmountCents,
  type ParsedPledgeDonation,
} from "@/lib/pledge-parse";
import {
  captureHeaders,
  extractPledgeSignature,
  verifyPledgeSignature,
} from "@/lib/pledge-webhook";

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
//   6.  Insert pledge_donations (ON CONFLICT DO NOTHING via unique).
//   7.  Increment pet_submissions.total_votes / total_donated_cents via
//       the public.increment_pet_votes() function (atomic).
//   8.  If the donation is an entry donation and the pet is still
//       pending_payment, transition to pending_review (admin approves
//       the photo separately).
//
// We always return 2xx once an event is logged. Pledge retries on
// non-2xx; we don't want retries for parse/mapping problems.
// =====================================================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = extractPledgeSignature(request.headers);
  const signatureVerified = verifyPledgeSignature(rawBody, signature);
  const headerSnapshot = captureHeaders(request.headers);

  let payload: Record<string, unknown>;
  try {
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    payload = { _parseError: true, _raw: rawBody.slice(0, 2000) };
  }

  // Refuse unsigned requests when a secret is configured.
  if (env.PLEDGE_WEBHOOK_SECRET && !signatureVerified) {
    try {
      const admin = createAdminClient();
      await admin.from("pledge_webhook_events").insert({
        pledge_event_id: typeof payload.id === "string" ? payload.id : null,
        event_type: typeof payload.event === "string" ? payload.event : null,
        signature_verified: false,
        processing_status: "failed",
        error_message: "Invalid signature",
        raw_payload: payload as never,
        raw_headers: headerSnapshot as never,
      });
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

  // ---- Idempotency check ---------------------------------------------
  if (parsed.eventId) {
    const { data: dupe } = await admin
      .from("pledge_webhook_events")
      .select("id, processing_status")
      .eq("pledge_event_id", parsed.eventId)
      .in("processing_status", ["processed", "unmapped"])
      .maybeSingle();
    if (dupe) {
      return NextResponse.json(
        { ok: true, deduped: true, eventId: parsed.eventId },
        { status: 200 },
      );
    }
  }

  // ---- Map to pet ----------------------------------------------------
  let petSubmissionId: string | null = null;
  let mapError: string | null = null;
  try {
    petSubmissionId = await mapDonationToPet(admin, parsed);
  } catch (err) {
    mapError = err instanceof Error ? err.message : String(err);
  }

  const donationType = classifyDonationType(parsed.eventType, petSubmissionId !== null);

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

  // ---- Insert pledge_donations (idempotent) ---------------------------
  const eventIdForDb = parsed.eventId ?? parsed.transactionId ?? crypto.randomUUID();
  const voteCredits = votesFromAmountCents(parsed.amountCents);

  const { data: donationRow, error: donationErr } = await admin
    .from("pledge_donations")
    .upsert(
      {
        pet_submission_id: petSubmissionId,
        pledge_event_id: eventIdForDb,
        pledge_transaction_id: parsed.transactionId,
        pledge_campaign_id: parsed.campaignId,
        pledge_widget_id: parsed.widgetId,
        pledge_fundraiser_id: parsed.fundraiserId,
        pledge_mapping_key: parsed.mappingKey,
        donor_name: parsed.donorName,
        donor_email: parsed.donorEmail,
        amount_cents: parsed.amountCents,
        tip_cents: parsed.tipCents,
        fee_cents: parsed.feeCents,
        currency: parsed.currency,
        vote_credits: voteCredits,
        donation_type: donationType,
        raw_payload: payload as never,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "pledge_event_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (donationErr) {
    await admin.from("pledge_webhook_events").insert({
      pledge_event_id: eventIdForDb,
      event_type: parsed.eventType,
      signature_verified: signatureVerified,
      processing_status: "failed",
      error_message: donationErr.message,
      raw_payload: payload as never,
      raw_headers: headerSnapshot as never,
    });
    return NextResponse.json({ ok: false, error: donationErr.message }, { status: 500 });
  }

  // ---- Apply vote increment to pet -----------------------------------
  if (petSubmissionId && voteCredits > 0) {
    await admin.rpc("increment_pet_votes", {
      p_pet_id: petSubmissionId,
      p_votes: voteCredits,
      p_cents: parsed.amountCents,
    });
  }

  // ---- Entry-donation status transition -------------------------------
  if (donationType === "entry" && petSubmissionId) {
    await admin
      .from("pet_submissions")
      .update({
        entry_donation_confirmed: true,
        status: "pending_review",
        entry_pledge_transaction_id: parsed.transactionId ?? eventIdForDb,
      })
      .eq("id", petSubmissionId)
      .eq("status", "pending_payment");
  }

  // ---- Audit log -----------------------------------------------------
  await admin.from("pledge_webhook_events").insert({
    pledge_event_id: eventIdForDb,
    event_type: parsed.eventType,
    signature_verified: signatureVerified,
    processing_status: petSubmissionId ? "processed" : "unmapped",
    pet_submission_id: petSubmissionId,
    donation_id: donationRow?.id ?? null,
    error_message: mapError,
    raw_payload: payload as never,
    raw_headers: headerSnapshot as never,
    processed_at: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      ok: true,
      eventId: eventIdForDb,
      mapped: petSubmissionId !== null,
      votes: voteCredits,
      donationType,
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
): Promise<string | null> {
  // 1. Custom field `submission_id` → direct UUID match.
  if (isUuid(parsed.customSubmissionId)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.customSubmissionId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 2. utm_content set to the pet UUID.
  if (isUuid(parsed.utmContent)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.utmContent)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 3. pledge_mapping_key configured by admin.
  if (parsed.mappingKey) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_mapping_key", parsed.mappingKey)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 4. widget_id (per-pet Pledge widget).
  if (parsed.widgetId) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_widget_id", parsed.widgetId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 5. campaign_id (per-pet Pledge campaign).
  if (parsed.campaignId) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_campaign_id", parsed.campaignId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}
