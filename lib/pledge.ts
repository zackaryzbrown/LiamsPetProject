import "server-only";
import { env } from "@/lib/env";

// =====================================================================
// Builds the URL we send users to for the $10 entry donation.
//
// Pet-specific override: if admin has configured a per-pet
// `pledge_donation_url`, we use that. Otherwise we fall back to the
// global PLEDGE_DEFAULT_DONATION_URL. We always append our
// SUBMISSION_FIELD_KEY query param so the webhook can map a donation
// back to the pet.
//
// Returns null if neither a per-pet URL nor a default is configured,
// so the UI can render a friendly "donation link not configured" state
// instead of a broken link.
// =====================================================================
export function buildEntryDonationUrl(
  submissionId: string,
  perPetUrl?: string | null,
): string | null {
  const base = perPetUrl ?? env.PLEDGE_DEFAULT_DONATION_URL;
  if (!base) return null;
  try {
    const u = new URL(base);
    u.searchParams.set(env.PLEDGE_SUBMISSION_FIELD_KEY, submissionId);
    // utm_content provides a second fallback the webhook can match on.
    u.searchParams.set("utm_content", submissionId);
    return u.toString();
  } catch {
    return null;
  }
}

// =====================================================================
// Builds the URL we send post-approval voters to (donate-to-vote).
// Same shape as the entry URL but the caller passes the per-pet URL.
// =====================================================================
export function buildVoteDonationUrl(
  submissionId: string,
  perPetUrl: string | null,
): string | null {
  return buildEntryDonationUrl(submissionId, perPetUrl);
}
