"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseTransaction,
  votesFromAmountCents,
  classifyKind,
} from "@/lib/givebutter-webhook";

export type ReconcileResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// =====================================================================
// Manually link a logged webhook event to a pet.
// Re-parses the raw payload and inserts (or upserts) the transaction.
// =====================================================================
const LinkSchema = z.object({
  rawEventId: z.string().uuid(),
  petSubmissionId: z.string().uuid(),
});

export async function linkWebhookToPet(formData: FormData): Promise<ReconcileResult> {
  await requireAdmin();
  const parsed = LinkSchema.safeParse({
    rawEventId: formData.get("rawEventId"),
    petSubmissionId: formData.get("petSubmissionId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = createAdminClient();

  const { data: event, error: fetchErr } = await admin
    .from("webhook_events_raw")
    .select("payload, event_type")
    .eq("id", parsed.data.rawEventId)
    .maybeSingle();
  if (fetchErr || !event) return { ok: false, error: "Event not found." };

  const parsedTxn = parseTransaction(
    (event.payload as Record<string, unknown>) ?? {},
  );
  if (!parsedTxn.transactionId) {
    return { ok: false, error: "Payload has no usable transaction id." };
  }
  if (parsedTxn.amountCents == null || parsedTxn.amountCents < 0) {
    return { ok: false, error: "Payload has no usable amount." };
  }

  const kind = classifyKind(parsedTxn.eventType);
  const votes = votesFromAmountCents(parsedTxn.amountCents);

  const { error: upsertErr } = await admin
    .from("vote_transactions")
    .upsert(
      {
        pet_submission_id: parsed.data.petSubmissionId,
        givebutter_transaction_id: parsedTxn.transactionId,
        kind,
        donor_name: parsedTxn.donorName,
        donor_email: parsedTxn.donorEmail,
        amount_cents: parsedTxn.amountCents,
        votes,
        raw_payload: ((event.payload as unknown) ?? {}) as never,
      },
      { onConflict: "givebutter_transaction_id", ignoreDuplicates: false },
    );
  if (upsertErr) return { ok: false, error: upsertErr.message };

  // Mark the event as resolved.
  await admin
    .from("webhook_events_raw")
    .update({
      matched: true,
      pet_submission_id: parsed.data.petSubmissionId,
      error: null,
    })
    .eq("id", parsed.data.rawEventId);

  // If this was an entry donation, promote the pet's status.
  if (kind === "entry") {
    await admin
      .from("pet_submissions")
      .update({ entry_donation_confirmed: true, status: "pending_review" })
      .eq("id", parsed.data.petSubmissionId)
      .eq("status", "pending_payment");
  }

  revalidatePath("/admin/reconciliation");
  revalidatePath(`/admin/submissions/${parsed.data.petSubmissionId}`);
  revalidatePath("/admin/leaderboard");
  revalidatePath("/vote");
  return { ok: true, message: `Linked transaction ${parsedTxn.transactionId.slice(0, 16)}…` };
}

// =====================================================================
// Dismiss an unmatched webhook event (e.g., test fires, refunds we don't
// want to count). Marks matched=true with a note, and removes any
// orphan vote_transactions row created from it.
// =====================================================================
const DismissSchema = z.object({
  rawEventId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export async function dismissWebhookEvent(formData: FormData): Promise<ReconcileResult> {
  await requireAdmin();
  const parsed = DismissSchema.safeParse({
    rawEventId: formData.get("rawEventId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("webhook_events_raw")
    .update({ matched: true, error: `dismissed: ${parsed.data.reason}` })
    .eq("id", parsed.data.rawEventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/reconciliation");
  return { ok: true, message: "Dismissed." };
}
