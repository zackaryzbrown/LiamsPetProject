"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePledgeWebhook } from "@/lib/pledge-parse";

export type ReconcileResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

// =====================================================================
// Manually link an unmapped pledge_webhook_events row to a pet.
//
// We re-parse the saved raw payload and hand the work to the same DB
// function the live webhook uses, so reconciliation follows the exact
// same entry/vote/ledger rules as production traffic.
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
  const { error: rpcErr } = await admin.rpc("process_pledge_donation", {
    p_pledge_event_id: eventIdForDb,
    p_event_type: re.eventType,
    p_signature_verified: true,
    p_raw_payload: payload as never,
    p_raw_headers: {} as never,
    p_pet_submission_id: parsed.data.petSubmissionId,
    p_matched_intent_id: null,
    p_pledge_transaction_id: re.transactionId,
    p_pledge_campaign_id: re.campaignId,
    p_pledge_widget_id: re.widgetId,
    p_pledge_fundraiser_id: re.fundraiserId,
    p_pledge_mapping_key: re.mappingKey,
    p_donor_name: re.donorName,
    p_donor_email: re.donorEmail,
    p_amount_cents: re.amountCents,
    p_tip_cents: re.tipCents,
    p_fee_cents: re.feeCents,
    p_currency: re.currency,
    p_error_message: null,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

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
