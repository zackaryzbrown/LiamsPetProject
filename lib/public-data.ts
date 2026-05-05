import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// Public-facing reads. Uses the request-bound (anon) client so RLS is
// enforced - anon can only see approved pets and the contest_settings row.

export type PublicPet = {
  id: string;
  petName: string;
  ownerName: string;
  imageUrl: string;
  totalVotes: number;
  totalAmountCents: number;
  approvedAt: string | null;
  givebutterMemberUrl: string | null;
  blurb?: string;
};

export type PublicContest = {
  contestOpen: boolean;
  goalAmountCents: number;
  raisedAmountCents: number;
  submissionDeadline: string | null;
  votingDeadline: string | null;
};

function buildPublicImageUrl(path: string | null): string | null {
  if (!path) return null;
  // Supabase storage public URL pattern.
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_BUCKET_PUBLIC}/${path}`;
}

export async function getApprovedPets(): Promise<PublicPet[]> {
  // If Supabase isn't configured yet (fresh clone), return empty so the
  // public pages render their empty states instead of 500ing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pet_leaderboard")
    .select(
      "id, pet_name, owner_name, public_image_path, givebutter_member_url, approved_at, total_votes, total_amount_cents",
    );
  if (error || !data) return [];
  return data
    .map((r) => {
      const url = buildPublicImageUrl(r.public_image_path as string | null);
      if (!url) return null;
      return {
        id: r.id as string,
        petName: r.pet_name as string,
        ownerName: r.owner_name as string,
        imageUrl: url,
        totalVotes: (r.total_votes as number) ?? 0,
        totalAmountCents: (r.total_amount_cents as number) ?? 0,
        approvedAt: (r.approved_at as string | null) ?? null,
        givebutterMemberUrl: (r.givebutter_member_url as string | null) ?? null,
      };
    })
    .filter((p): p is PublicPet => p !== null)
    .sort((a, b) => b.totalVotes - a.totalVotes);
}

export async function getPublicContest(): Promise<PublicContest> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      contestOpen: false,
      goalAmountCents: 50000,
      raisedAmountCents: 0,
      submissionDeadline: null,
      votingDeadline: null,
    };
  }
  const supabase = await createClient();
  const admin = createAdminClient();
  const [settingsRes, txnRes] = await Promise.all([
    supabase
      .from("contest_settings")
      .select("contest_open, goal_amount_cents, submission_deadline, voting_deadline")
      .eq("id", 1)
      .maybeSingle(),
    // Total raised counts only ORIGINAL transactions (parent IS NULL).
    // Credit allocations (children) are pet-targeted bookkeeping, not new
    // donations, so we exclude them to avoid double-counting.
    admin
      .from("vote_transactions")
      .select("amount_cents")
      .is("parent_transaction_id", null),
  ]);
  const s = settingsRes.data;
  const raisedAmountCents = (txnRes.data ?? []).reduce(
    (sum, r) => sum + ((r.amount_cents as number) ?? 0),
    0,
  );
  return {
    contestOpen: (s?.contest_open as boolean | undefined) ?? false,
    goalAmountCents: (s?.goal_amount_cents as number | undefined) ?? 50000,
    raisedAmountCents,
    submissionDeadline: (s?.submission_deadline as string | null | undefined) ?? null,
    votingDeadline: (s?.voting_deadline as string | null | undefined) ?? null,
  };
}
