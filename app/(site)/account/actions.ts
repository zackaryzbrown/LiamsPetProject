"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContestWindowSettings, votingOpenNow } from "@/lib/contest-state";

// =====================================================================
// spendVoteCreditsAction
//
// Spend a portion of the signed-in user's vote-credit wallet on a pet.
// Delegates to the `spend_vote_credits` Postgres function so the
// balance check + ledger insert + pet vote increment happen atomically
// under row locks. The RPC itself rejects:
//   - non-whole-vote amounts ($1 per vote)
//   - balances < requested cents
//   - pets that don't exist or aren't approved
// =====================================================================

const SpendSchema = z.object({
  petSubmissionId: z.string().uuid(),
  // Whole-dollar votes. Multiplied by 100 before the RPC.
  votes: z.coerce.number().int().min(1).max(100_000),
});

export type SpendResult =
  | { ok: true; remainingCents: number }
  | { ok: false; error: string };

export async function spendVoteCreditsAction(
  formData: FormData,
): Promise<SpendResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to vote." };

  const contest = await getContestWindowSettings();
  if (!contest || !votingOpenNow(contest)) {
    return { ok: false, error: "Voting is currently closed." };
  }

  const parsed = SpendSchema.safeParse({
    petSubmissionId: formData.get("petSubmissionId"),
    votes: formData.get("votes"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const admin = createAdminClient();
  const { data: remaining, error } = await admin.rpc("spend_vote_credits", {
    p_user_id: user.id,
    p_pet_submission_id: parsed.data.petSubmissionId,
    p_cents: parsed.data.votes * 100,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/account");
  revalidatePath("/vote");
  return {
    ok: true,
    remainingCents: typeof remaining === "number" ? remaining : 0,
  };
}
