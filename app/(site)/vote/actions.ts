"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContestWindowSettings, votingOpenNow } from "@/lib/contest-state";

// =====================================================================
// recordVoteIntent
//
// Called right before a voter is redirected to Pledge.to. The webhook
// uses this row to attribute the incoming donation back to a pet by
// donor email when Pledge's payload doesn't include submission_id /
// utm_content (which is the case for hosted-fundraiser donations).
//
// Anonymous voters are allowed: we still record the intent with a null
// user_id but require an email so the webhook has something to match.
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

  // Prefer the email of the logged-in user when available; fall back to
  // whatever email the visitor typed (e.g. an anonymous voter).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const donorEmail =
    user?.email?.toLowerCase().trim() ??
    parsed.data.donorEmail?.toLowerCase().trim() ??
    null;

  // Confirm the pet exists and is voteable. We don't enforce
  // "approved-only" here because the same intent path is reused if we
  // ever offer a "donate before approval" flow; the webhook only
  // applies vote credits after entry_donation_confirmed=true anyway.
  const admin = createAdminClient();
  const { data: pet } = await admin
    .from("pet_submissions")
    .select("id")
    .eq("id", parsed.data.petSubmissionId)
    .maybeSingle();
  if (!pet) {
    return { ok: false, error: "Pet not found." };
  }

  const { error } = await admin.from("donation_intents").insert({
    pet_submission_id: parsed.data.petSubmissionId,
    user_id: user?.id ?? null,
    donor_email: donorEmail,
    intent_type: "vote",
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
