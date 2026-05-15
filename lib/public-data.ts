import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getTotalRaisedCents } from "@/lib/donation-totals";
import { buildVoteDonationUrl } from "@/lib/pledge";

// =====================================================================
// Public read model for the marketing site (home + /vote + /account).
// All Pledge.to. No credit wallet, no leaderboard view — totals come
// straight off pet_submissions, which the webhook keeps current.
// =====================================================================

export type PublicPet = {
  id: string;
  petName: string;
  ownerName: string;
  imageUrl: string;
  totalVotes: number;
  totalDonatedCents: number;
  approvedAt: string;
  // Pre-built donate-to-vote URL. May be null if Pledge.to links haven't
  // been configured (per pet) AND no fallback default is set.
  pledgeDonationUrl: string | null;
};

export type PublicContest = {
  contestOpen: boolean;
  submissionsOpen: boolean;
  votingOpen: boolean;
  votingDeadline: string;
  submissionDeadline: string;
  goalAmountCents: number;
  raisedAmountCents: number;
};

function publicImageUrl(adminClient: ReturnType<typeof createAdminClient>, path: string): string {
  const { data } = adminClient.storage.from(env.SUPABASE_BUCKET_PUBLIC).getPublicUrl(path);
  return data.publicUrl;
}

// Approved pets, ordered by total_votes (denormalized; bumped by the
// Pledge webhook and by manual_vote_audit transactions).
export async function getApprovedPets(): Promise<PublicPet[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from("pet_submissions")
    .select(
      "id, pet_name, owner_name, public_image_path, total_votes, total_donated_cents, approved_at, pledge_donation_url",
    )
    .eq("status", "approved")
    .not("public_image_path", "is", null)
    .order("total_votes", { ascending: false });
  if (error || !data) return [];

  return data
    .filter((r) => r.public_image_path)
    .map((r) => ({
      id: r.id,
      petName: r.pet_name,
      ownerName: r.owner_name,
      imageUrl: publicImageUrl(admin, r.public_image_path as string),
      totalVotes: r.total_votes,
      totalDonatedCents: r.total_donated_cents,
      approvedAt: r.approved_at ?? "",
      pledgeDonationUrl: buildVoteDonationUrl(r.id, r.pledge_donation_url),
    }));
}

// Contest settings + running raised total. Running total is the sum of
// approved pets' total_donated_cents (kept current by the webhook).
export async function getPublicContest(): Promise<PublicContest | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }
  const { data: settings, error: sErr } = await admin
    .from("contest_settings")
    .select(
      "contest_open, submissions_open, voting_open, submission_deadline, voting_deadline, goal_amount_cents",
    )
    .eq("id", 1)
    .maybeSingle();
  if (sErr || !settings) return null;

  const raised = await getTotalRaisedCents();

  return {
    contestOpen: settings.contest_open,
    submissionsOpen: settings.submissions_open,
    votingOpen: settings.voting_open,
    votingDeadline: settings.voting_deadline,
    submissionDeadline: settings.submission_deadline,
    goalAmountCents: settings.goal_amount_cents,
    raisedAmountCents: raised,
  };
}
