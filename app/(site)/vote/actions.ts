"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getContestWindowSettings, votingOpenNow } from "@/lib/contest-state";

// =====================================================================
// recordVoteIntent
//
// Called right before a voter is redirected to Pledge.to. The webhook
// uses this row to attribute the incoming donation back to a pet by
// donor email when Pledge's payload doesn't include submission_id /
// utm_content (which is the case for hosted-fundraiser donations).
//
// Vote intents now require an authenticated user so the fallback email
// mapping can only point at a verified account.
// =====================================================================
const InputSchema = z.object({
  petSubmissionId: z.string().uuid(),
  donorEmail: z.string().trim().email().max(254).optional().nullable(),
});

export type RecordVoteIntentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function recordVoteIntent(
  input: z.infer<typeof InputSchema>,
): Promise<RecordVoteIntentResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  const contest = await getContestWindowSettings();
  if (!contest || !votingOpenNow(contest)) {
    return { ok: false, error: "Voting is currently closed." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const donorEmail = user?.email?.toLowerCase().trim() ?? null;
  if (!user || !donorEmail) {
    return { ok: false, error: "Please sign in before donating to vote." };
  }

  const { data: pet } = await supabase
    .from("pet_submissions")
    .select("id")
    .eq("id", parsed.data.petSubmissionId)
    .eq("status", "approved")
    .maybeSingle();
  if (!pet) {
    return { ok: false, error: "Pet not found." };
  }

  const { error } = await supabase.from("donation_intents").insert({
    pet_submission_id: parsed.data.petSubmissionId,
    user_id: user.id,
    donor_email: donorEmail,
    intent_type: "vote",
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
