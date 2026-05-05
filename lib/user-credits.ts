import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the signed-in user's spendable vote credits (totalCredits - alreadySpent),
 * or 0 if not signed in / nothing credited.
 */
export async function getUserVoteCreditBalance(): Promise<{
  signedIn: boolean;
  remaining: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, remaining: 0 };

  const admin = createAdminClient();
  const [creditsRes, spentRes] = await Promise.all([
    admin
      .from("vote_transactions")
      .select("votes")
      .eq("donor_user_id", user.id)
      .is("pet_submission_id", null)
      .is("parent_transaction_id", null),
    admin
      .from("vote_transactions")
      .select("votes")
      .eq("donor_user_id", user.id)
      .not("parent_transaction_id", "is", null),
  ]);
  const credits = (creditsRes.data ?? []).reduce(
    (s, r) => s + ((r.votes as number) ?? 0),
    0,
  );
  const spent = (spentRes.data ?? []).reduce(
    (s, r) => s + ((r.votes as number) ?? 0),
    0,
  );
  return { signedIn: true, remaining: Math.max(0, credits - spent) };
}
