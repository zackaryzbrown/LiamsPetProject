"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyDonationType,
  parsePledgeWebhook,
  votesFromAmountCents,
} from "@/lib/pledge-parse";

export type ReconcileResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

// =====================================================================
// Manually link an unmapped pledge_webhook_events row to a pet.
//
// We re-parse the saved raw payload, upsert into pledge_donations,
// bump pet totals via increment_pet_votes, and mark the event row as
// processed. Idempotent on pledge_event_id thanks to the unique index.
// =====================================================================
const LinkSchema = z.object({
  eventRowId: z.string().uuid(),
  petSubmissionId: z.string().uuid(),
});

export async function linkWebhookToPet(formData: FormData): Promise<ReconcileResult> {
  await requireAdmin();
  const parsed = LinkSchema.safeParse({
    eventRowId: formData.get("eventRowId"),
    petSubmissionId: formData.get("petSubmissionId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = createAdminClient();

  const { data: row, error: fetchErr } = await admin
    .from("pledge_webhook_events")
    .select("id, pledge_event_id, event_type, raw_payload")
    .eq("id", parsed.data.eventRowId)
    .maybeSingle();
  if (fetchErr || !row) return { ok: false, error: "Event not found." };

  const payload =
    typeof row.raw_payload === "object" && row.raw_payload !== null
      ? (row.raw_payload as Record<string, unknown>)
      : {};
  const re = parsePledgeWebhook(payload);
  if (re.amountCents == null || re.amountCents < 0) {
    return { ok: false, error: "Could not read donation amount from payload." };
  }

  const eventIdForDb = re.eventId ?? row.pledge_event_id ?? re.transactionId ?? row.id;
  const voteCredits = votesFromAmountCents(re.amountCents);
  const donationType = classifyDonationType(re.eventType, true);

  const { data: donationRow, error: donationErr } = await admin
    .from("pledge_donations")
    .upsert(
      {
        pet_submission_id: parsed.data.petSubmissionId,
        pledge_event_id: eventIdForDb,
        pledge_transaction_id: re.transactionId,
        pledge_campaign_id: re.campaignId,
        pledge_widget_id: re.widgetId,
        pledge_fundraiser_id: re.fundraiserId,
        pledge_mapping_key: re.mappingKey,
        donor_name: re.donorName,
        donor_email: re.donorEmail,
        amount_cents: re.amountCents,
        tip_cents: re.tipCents,
        fee_cents: re.feeCents,
        currency: re.currency,
        vote_credits: voteCredits,
        donation_type: donationType,
        raw_payload: payload as never,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "pledge_event_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (donationErr) return { ok: false, error: donationErr.message };

  if (voteCredits > 0) {
    const { error: rpcErr } = await admin.rpc("increment_pet_votes", {
      p_pet_id: parsed.data.petSubmissionId,
      p_votes: voteCredits,
      p_cents: re.amountCents,
    });
    if (rpcErr) return { ok: false, error: rpcErr.message };
  }

  const { error: updErr } = await admin
    .from("pledge_webhook_events")
    .update({
      processing_status: "processed",
      pet_submission_id: parsed.data.petSubmissionId,
      donation_id: donationRow?.id ?? null,
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", parsed.data.eventRowId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/reconciliation");
  revalidatePath(`/admin/submissions/${parsed.data.petSubmissionId}`);
  revalidatePath("/admin/leaderboard");
  revalidatePath("/vote");
  return { ok: true, message: "Linked." };
}

// =====================================================================
// Dismiss an unmapped event (e.g. test data, refund, duplicate).
// Marks the row as failed with a reason; nothing is inserted into
// pledge_donations and no totals change.
// =====================================================================
const DismissSchema = z.object({
  eventRowId: z.string().uuid(),
  reason: z.string().trim().min(1, "Reason is required.").max(500),
});

export async function dismissWebhookEvent(formData: FormData): Promise<ReconcileResult> {
  await requireAdmin();
  const parsed = DismissSchema.safeParse({
    eventRowId: formData.get("eventRowId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("pledge_webhook_events")
    .update({
      processing_status: "failed",
      error_message: `Dismissed by admin: ${parsed.data.reason}`,
      processed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.eventRowId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/reconciliation");
  return { ok: true, message: "Dismissed." };
}
