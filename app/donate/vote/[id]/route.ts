import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContestWindowSettings, votingOpenNow } from "@/lib/contest-state";
import { env } from "@/lib/env";
import { buildVoteCheckoutUrl } from "@/lib/pledge";
import { createVoteIntentToken } from "@/lib/vote-intent-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
    requestUrl.hostname,
  );

  if (!isLoopback || process.env.NODE_ENV !== "production") {
    return requestUrl.origin;
  }

  return new URL(env.NEXT_PUBLIC_SITE_URL).origin;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const origin = publicOrigin(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", `/donate/vote/${id}`);
    return NextResponse.redirect(loginUrl);
  }

  const contest = await getContestWindowSettings();
  if (!contest || !votingOpenNow(contest)) {
    return NextResponse.redirect(new URL("/vote?error=voting_closed", origin));
  }

  const { data: pet } = await supabase
    .from("pet_submissions")
    .select("id, pledge_donation_url")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!pet) {
    return NextResponse.redirect(new URL("/vote?error=pet_not_found", origin));
  }

  const donorEmail = user.email.toLowerCase().trim();
  const { data: intent, error: intentErr } = await supabase
    .from("donation_intents")
    .insert({
      pet_submission_id: pet.id,
      user_id: user.id,
      donor_email: donorEmail,
      intent_type: "vote",
    })
    .select("id, expires_at")
    .single();
  if (intentErr || !intent) {
    return NextResponse.redirect(
      new URL("/vote?error=vote_intent_failed", origin),
    );
  }

  const donationUrl = buildVoteCheckoutUrl(pet.id, pet.pledge_donation_url, {
    intentToken: createVoteIntentToken({
      intentId: intent.id,
      petSubmissionId: pet.id,
      expiresAt: intent.expires_at,
    }),
  });
  if (!donationUrl) {
    return NextResponse.redirect(
      new URL("/vote?error=donation_link_missing", origin),
    );
  }

  return NextResponse.redirect(donationUrl);
}
