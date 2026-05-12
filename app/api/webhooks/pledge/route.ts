import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  classifyDonationType,
  isUuid,
  parsePledgeWebhook,
  votesFromAmountCents,
  ENTRY_FEE_CENTS,
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
    // Non-secret fingerprint of the secret currently in use, so we can
    // verify (without leaking the value) that the running Lambda has the
    // expected secret baked in. Pledge signs with HMAC-SHA256(api_key,
    // body) → base64; if the fingerprint here doesn't match the first 8
    // chars of what we'd expect, the wrong secret is live.
    const secret = env.PLEDGE_WEBHOOK_SECRET ?? "";
    const secretFingerprint =
      secret.length >= 4
        ? `${secret.slice(0, 4)}…${secret.slice(-2)} (len ${secret.length})`
        : `len ${secret.length}`;
    try {
      const admin = createAdminClient();
      await admin.from("pledge_webhook_events").insert({
        pledge_event_id: typeof payload.id === "string" ? payload.id : null,
        event_type: typeof payload.event === "string" ? payload.event : null,
        signature_verified: false,
        processing_status: "failed",
        error_message: `Invalid signature (secret fingerprint: ${secretFingerprint})`,
        raw_payload: payload as never,
        raw_headers: headerSnapshot as never,
      });
    } catch {
      // best-effort logging; we still return 401.
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid signature",
        secretFingerprint,
        signatureReceived: signature ? `${signature.slice(0, 8)}…` : null,
      },
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
  let matchedIntentId: string | null = null;
  let mapError: string | null = null;
  try {
    const mapped = await mapDonationToPet(admin, parsed);
    petSubmissionId = mapped.petSubmissionId;
    matchedIntentId = mapped.intentId;
  } catch (err) {
    mapError = err instanceof Error ? err.message : String(err);
  }

  // ---- Decide entry vs vote --------------------------------------------
  // RULE: the very first donation to a pet is the entry donation and
  // earns ZERO votes. Every donation after that is a vote donation
  // ($1 = 1 vote). We discriminate using `entry_donation_confirmed`
  // (NOT status) because:
  //   - Pledge sends `donation.completed` for everything, so the event
  //     type itself can't tell us.
  //   - Status-based checks (was the pet pending_payment when the
  //     donation arrived?) break when the webhook arrives AFTER the
  //     admin has already approved the pet (e.g. a retried/replayed
  //     delivery, or a slow webhook). The flag is order-independent.
  let entryAlreadyConfirmed: boolean | null = null;
  if (petSubmissionId) {
    const { data: petRow } = await admin
      .from("pet_submissions")
      .select("entry_donation_confirmed")
      .eq("id", petSubmissionId)
      .maybeSingle();
    entryAlreadyConfirmed = (petRow?.entry_donation_confirmed as boolean | null) ?? null;
  }
  // First donation to this pet = entry. Subsequent donations = votes.
  const isEntryDonation =
    petSubmissionId !== null && entryAlreadyConfirmed === false;
  const donationType: "entry" | "vote" | "general" | "unknown" = isEntryDonation
    ? "entry"
    : classifyDonationType(parsed.eventType, petSubmissionId !== null);

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
  // Entry donations NEVER earn votes, regardless of amount. Submitting a
  // pet is not the same as voting for a pet — votes only come from the
  // /vote page after the pet is approved. Entry money still counts toward
  // "raised" because it really does go to Soul Dog Rescue.
  const voteCredits = isEntryDonation
    ? 0
    : votesFromAmountCents(parsed.amountCents);

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

  // ---- Mark the matched donation_intent as consumed ------------------
  // Done only after the donation row has been successfully inserted so
  // we never lose an intent to a failed write. The intent will then be
  // skipped by future webhook lookups (e.g. replays).
  let intentUserId: string | null = null;
  if (matchedIntentId && donationRow?.id) {
    const { data: intentRow } = await admin
      .from("donation_intents")
      .update({
        consumed_at: new Date().toISOString(),
        consumed_donation_id: donationRow.id,
      })
      .eq("id", matchedIntentId)
      .is("consumed_at", null)
      .select("user_id")
      .maybeSingle();
    intentUserId = (intentRow?.user_id as string | null) ?? null;
  }

  // ---- Entry-overage → vote credits ----------------------------------
  // The first $10 of an entry donation is the contest entry fee
  // (non-refundable, 0 votes). Any overage becomes spendable vote
  // credits in the entrant's wallet. Requires us to know which user
  // submitted the entry, which we get from the matched donation_intent
  // (entries are gated behind auth, so this is always populated for the
  // real flow; if a webhook arrives without a matched intent we skip the
  // deposit and the admin reconciliation tool can fix it manually).
  if (
    isEntryDonation &&
    intentUserId &&
    donationRow?.id &&
    parsed.amountCents > ENTRY_FEE_CENTS
  ) {
    const overageCents = parsed.amountCents - ENTRY_FEE_CENTS;
    await admin.from("vote_credit_ledger").insert({
      user_id: intentUserId,
      delta_cents: overageCents,
      source_donation_id: donationRow.id,
      reason: "entry_overage",
    });
  }

  // ---- General fundraiser donations → vote credits -------------------
  // A donation that didn't map to any pet (e.g. the navbar "Donate"
  // button which points at the campaign-wide fundraiser page) gets
  // attributed to the donor's wallet so they can spend it as votes
  // later. We match by donor_email → auth.users.email. If there's no
  // matching account, the donation still counts toward "raised" but no
  // wallet credit is issued — admins can resolve those via the
  // reconciliation queue.
  if (
    !petSubmissionId &&
    donationRow?.id &&
    parsed.amountCents > 0 &&
    parsed.donorEmail
  ) {
    const { data: userIdData } = await admin.rpc("find_user_id_by_email", {
      p_email: parsed.donorEmail,
    });
    const generalUserId =
      typeof userIdData === "string" ? userIdData : null;
    if (generalUserId) {
      await admin.from("vote_credit_ledger").insert({
        user_id: generalUserId,
        delta_cents: parsed.amountCents,
        source_donation_id: donationRow.id,
        reason: "general_donation",
      });
    }
  }

  // ---- Apply vote increment to pet -----------------------------------
  // Entry donations earn ZERO votes regardless of amount. Submitting a
  // pet is not voting for a pet. The full amount still counts toward
  // "raised" because the money really does go to Soul Dog Rescue.
  // Non-entry donations: $1 = 1 vote.
  //
  // For account-holders we route the vote through the ledger as a
  // "deposit + auto-spend" pair so the donation is recorded against
  // their wallet (auditable, refundable to other pets if we ever
  // needed to). Net effect on the pet is identical to a direct vote.
  // Truly anonymous donors (donor_email doesn't match any account)
  // skip the ledger and get a direct vote increment so the per-pet
  // share link still works for guests.
  if (!isEntryDonation && petSubmissionId && parsed.amountCents > 0) {
    let voterUserId: string | null = intentUserId;
    if (!voterUserId && parsed.donorEmail) {
      const { data: userIdData } = await admin.rpc("find_user_id_by_email", {
        p_email: parsed.donorEmail,
      });
      voterUserId = typeof userIdData === "string" ? userIdData : null;
    }

    if (voterUserId && donationRow?.id) {
      // Deposit the donation into the donor's wallet…
      await admin.from("vote_credit_ledger").insert({
        user_id: voterUserId,
        delta_cents: parsed.amountCents,
        source_donation_id: donationRow.id,
        reason: "donation_vote",
      });
      // …then immediately spend it on the originating pet.
      await admin.from("vote_credit_ledger").insert({
        user_id: voterUserId,
        delta_cents: -parsed.amountCents,
        source_donation_id: donationRow.id,
        pet_submission_id: petSubmissionId,
        reason: "auto_spend",
      });
      // Bump pet vote count + raised total directly. We don't call
      // spend_vote_credits here because we just inserted the ledger
      // rows ourselves and want to count the raised cents exactly
      // once (the donation row already represents the raise).
      await admin.rpc("increment_pet_votes", {
        p_pet_id: petSubmissionId,
        p_votes: voteCredits,
        p_cents: parsed.amountCents,
      });
    } else {
      // Anonymous donor — direct vote, no wallet involvement.
      await admin.rpc("increment_pet_votes", {
        p_pet_id: petSubmissionId,
        p_votes: voteCredits,
        p_cents: parsed.amountCents,
      });
    }
  } else if (isEntryDonation && petSubmissionId && parsed.amountCents > 0) {
    // Entry donations still need to bump "raised" (0 votes).
    await admin.rpc("increment_pet_votes", {
      p_pet_id: petSubmissionId,
      p_votes: 0,
      p_cents: parsed.amountCents,
    });
  }

  // ---- Entry-donation status transition -------------------------------
  // Flip pending_payment → pending_review so admins can review the photo.
  // ---- Entry-donation transition -------------------------------------
  // First donation to this pet:
  //   - always flip entry_donation_confirmed=true (so any future
  //     donation correctly counts as a vote)
  //   - if the pet is still pending_payment, move it to pending_review
  //     so admins can review the photo. If the pet was already approved
  //     (e.g. admin approved before this webhook arrived), leave the
  //     status alone.
  if (isEntryDonation && petSubmissionId) {
    await admin
      .from("pet_submissions")
      .update({
        entry_donation_confirmed: true,
        entry_pledge_transaction_id: parsed.transactionId ?? eventIdForDb,
      })
      .eq("id", petSubmissionId);
    await admin
      .from("pet_submissions")
      .update({ status: "pending_review" })
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
): Promise<{ petSubmissionId: string | null; intentId: string | null }> {
  // 1. Custom field `submission_id` → direct UUID match.
  if (isUuid(parsed.customSubmissionId)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.customSubmissionId)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 2. utm_content set to the pet UUID.
  if (isUuid(parsed.utmContent)) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("id", parsed.utmContent)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 3. pledge_mapping_key configured by admin.
  if (parsed.mappingKey) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_mapping_key", parsed.mappingKey)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 4. widget_id (per-pet Pledge widget).
  if (parsed.widgetId) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_widget_id", parsed.widgetId)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 5. campaign_id (per-pet Pledge campaign).
  if (parsed.campaignId) {
    const { data } = await admin
      .from("pet_submissions")
      .select("id")
      .eq("pledge_campaign_id", parsed.campaignId)
      .maybeSingle();
    if (data?.id) return { petSubmissionId: data.id as string, intentId: null };
  }

  // 6. Donor-email intent lookup. Pledge's hosted donation page drops
  //    URL query params, so signals 1–5 are unreachable for the common
  //    "click donate-to-vote" flow. As a fallback, we look for the most
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
