import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  classifyKind,
  extractSignature,
  parseTransaction,
  verifySignature,
  votesFromAmountCents,
  type ParsedTransaction,
} from "@/lib/givebutter-webhook";

// Givebutter webhook receiver.
//
// Contract (intentionally permissive - see lib/givebutter-webhook.ts TODOs):
//   1. Read raw body, verify HMAC signature against GIVEBUTTER_WEBHOOK_SECRET.
//   2. Persist EVERY inbound payload into webhook_events_raw before doing
//      anything else (audit + replay).
//   3. Parse known fields, look up the pet by (priority order):
//        a. custom field `submission_id`            → exact match
//        b. utm_content                              → exact match
//        c. givebutter_member_id (per-pet member)    → exact match on pet_submissions
//        d. owner email + most recent submission     → fuzzy fallback
//      If none match, leave matched=false and surface in the admin queue.
//   4. Insert a vote_transactions row with $1 = 1 vote, idempotent on
//      givebutter_transaction_id (ON CONFLICT DO NOTHING).
//   5. If the event is an entry donation and the pet is in pending_payment,
//      promote it to pending_review (admin still has to approve the photo).
//
// We always respond 200 once the raw event is logged. Returning non-2xx
// causes Givebutter to retry, which we don't want for parsing/mapping
// issues - those are reconciled in /admin/reconciliation.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = extractSignature(request.headers);
  const signatureValid = verifySignature(rawBody, signature);

  let payload: Record<string, unknown>;
  try {
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    // Log and ack - we don't want to retry malformed bodies.
    payload = { _parseError: true, _raw: rawBody.slice(0, 2000) };
  }

  // If we have a secret configured, refuse unsigned requests outright.
  // If we don't have a secret, log with signature_valid=false but still
  // accept (so devs can wire things up before going live).
  if (env.GIVEBUTTER_WEBHOOK_SECRET && !signatureValid) {
    // Persist the rejection too, for visibility in the admin queue.
    try {
      const admin = createAdminClient();
      await admin.from("webhook_events_raw").insert({
        source: "givebutter",
        event_type: typeof payload.event === "string" ? payload.event : null,
        signature_valid: false,
        matched: false,
        payload: payload as never,
        error: "Invalid signature",
      });
    } catch {
      // Swallow - we're already returning 401.
    }
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const admin = createAdminClient();
  const parsed = parseTransaction(payload);

  // ---- Pet mapping ----------------------------------------------------
  let petSubmissionId: string | null = null;
  let mapError: string | null = null;
  try {
    petSubmissionId = await mapToPet(admin, parsed);
  } catch (err) {
    mapError = err instanceof Error ? err.message : String(err);
  }

  // ---- Persist raw event ---------------------------------------------
  // We do this whether or not we matched a pet, so admins can review.
  const { data: rawEvent } = await admin
    .from("webhook_events_raw")
    .insert({
      source: "givebutter",
      event_type: parsed.eventType,
      signature_valid: signatureValid,
      matched: petSubmissionId !== null,
      pet_submission_id: petSubmissionId,
      payload: payload as never,
      error: mapError,
    })
    .select("id")
    .single();

  // ---- Refuse to process if we can't even identify the transaction ----
  if (!parsed.transactionId) {
    return NextResponse.json(
      { ok: true, note: "Logged; missing transaction id, no vote recorded.", rawId: rawEvent?.id },
      { status: 200 },
    );
  }
  if (parsed.amountCents == null || parsed.amountCents < 0) {
    return NextResponse.json(
      { ok: true, note: "Logged; missing/invalid amount.", rawId: rawEvent?.id },
      { status: 200 },
    );
  }

  // ---- Idempotent insert into vote_transactions -----------------------
  // The unique constraint on givebutter_transaction_id is the dedupe key.
  // We use upsert with ignoreDuplicates so retries are no-ops.
  const kind = classifyKind(parsed.eventType);
  const votes = votesFromAmountCents(parsed.amountCents);

  const { error: insertErr } = await admin
    .from("vote_transactions")
    .upsert(
      {
        pet_submission_id: petSubmissionId,
        givebutter_transaction_id: parsed.transactionId,
        kind,
        donor_name: parsed.donorName,
        donor_email: parsed.donorEmail,
        amount_cents: parsed.amountCents,
        votes,
        raw_payload: payload as never,
      },
      { onConflict: "givebutter_transaction_id", ignoreDuplicates: true },
    );

  if (insertErr) {
    return NextResponse.json(
      { ok: false, error: insertErr.message, rawId: rawEvent?.id },
      { status: 500 },
    );
  }

  // ---- Status transition for entry donations --------------------------
  // If this is an entry donation and we identified the pet, promote it
  // from pending_payment → pending_review. This is a one-way transition
  // here; admin handles approval/rejection.
  if (kind === "entry" && petSubmissionId) {
    await admin
      .from("pet_submissions")
      .update({ entry_donation_confirmed: true, status: "pending_review" })
      .eq("id", petSubmissionId)
      .eq("status", "pending_payment");
  }

  return NextResponse.json(
    {
      ok: true,
      matched: petSubmissionId !== null,
      transactionId: parsed.transactionId,
      votes,
      kind,
    },
    { status: 200 },
  );
}

// =====================================================================
// Pet mapping
// =====================================================================
// Tries the strongest signals first. Returns null if nothing matches -
// the raw event is still logged for admin reconciliation.
async function mapToPet(
  admin: ReturnType<typeof createAdminClient>,
  parsed: ParsedTransaction,
): Promise<string | null> {
  // 1. Custom field - strongest signal (we set this on the entry checkout URL).
  if (parsed.customSubmissionId && isUuid(parsed.customSubmissionId)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.customSubmissionId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 2. utm_content fallback (also set on the entry checkout URL).
  if (parsed.utmContent && isUuid(parsed.utmContent)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.utmContent)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 3. Per-pet Givebutter member id (admin sets these on approval).
  if (parsed.memberId) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("givebutter_member_id", parsed.memberId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 4. Member slug (substring match on the configured member URL).
  // TODO: This is best-effort; tighten once Givebutter member URL format is confirmed.
  if (parsed.memberSlug) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id, givebutter_member_url")
      .ilike("givebutter_member_url", `%${parsed.memberSlug}%`)
      .limit(2);
    if (data && data.length === 1) return data[0].id as string;
  }

  // 5. Nothing matched - the admin will reconcile.
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
