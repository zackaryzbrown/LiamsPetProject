import { createAdminClient } from "@/lib/supabase/admin";

// =====================================================================
// Vote-credit wallet — read-only helpers.
//
// Users earn credits when an entry donation exceeds the $10 entry fee
// (see `app/api/webhooks/pledge/route.ts`). Credits live in the
// `vote_credit_ledger` table — positive rows are deposits, negative
// rows are spends. Balance = sum(delta_cents).
//
// Spending happens through the `spendVoteCreditsAction` server action
// in `app/(site)/account/actions.ts`, which calls the
// `spend_vote_credits` Postgres function for an atomic
// check-and-deduct under row locks.
// =====================================================================

export async function getCreditBalanceCents(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_vote_credit_balance", {
    p_user_id: userId,
  });
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export type CreditLedgerEntry = {
  id: string;
  delta_cents: number;
  created_at: string;
  reason: string | null;
  pet_submission_id: string | null;
  pet_name: string | null;
};

export async function getCreditHistory(
  userId: string,
  limit = 50,
): Promise<CreditLedgerEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vote_credit_ledger")
    .select(
      "id, delta_cents, created_at, reason, pet_submission_id, pet_submissions(pet_name)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    delta_cents: row.delta_cents as number,
    created_at: row.created_at as string,
    reason: (row.reason as string | null) ?? null,
    pet_submission_id: (row.pet_submission_id as string | null) ?? null,
    pet_name:
      ((row as unknown as { pet_submissions?: { pet_name?: string } })
        .pet_submissions?.pet_name as string | undefined) ?? null,
  }));
}
