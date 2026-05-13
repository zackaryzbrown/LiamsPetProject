import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ContestWindowSettings = {
  submissionsOpen: boolean;
  votingOpen: boolean;
  submissionDeadline: string;
  votingDeadline: string;
};

function hasFutureDeadline(iso: string): boolean {
  const at = new Date(iso).getTime();
  return Number.isFinite(at) && at > Date.now();
}

export function submissionsOpenNow(settings: ContestWindowSettings): boolean {
  return settings.submissionsOpen && hasFutureDeadline(settings.submissionDeadline);
}

export function votingOpenNow(settings: ContestWindowSettings): boolean {
  return settings.votingOpen && hasFutureDeadline(settings.votingDeadline);
}

export async function getContestWindowSettings(): Promise<ContestWindowSettings | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("contest_settings")
      .select("submissions_open, voting_open, submission_deadline, voting_deadline")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      submissionsOpen: data.submissions_open,
      votingOpen: data.voting_open,
      submissionDeadline: data.submission_deadline,
      votingDeadline: data.voting_deadline,
    };
  } catch {
    return null;
  }
}
