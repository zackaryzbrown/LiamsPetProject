import "server-only";
import { env } from "@/lib/env";

function normalizePledgeDonationHost(u: URL): void {
  // Some older configs used staging.pledge.to, which serves 404 for
  // public donation pages. Normalize to the public host.
  if (u.hostname.toLowerCase() === "staging.pledge.to") {
    u.hostname = "www.pledge.to";
    u.port = "";
  }
}

type PledgeIntentOptions = {
  intentToken?: string | null;
};

function buildPledgeDonationUrl(
  submissionId: string,
  baseUrl: string | null | undefined,
  options?: PledgeIntentOptions,
): string | null {
  if (!baseUrl) return null;
  try {
    const u = new URL(baseUrl);
    normalizePledgeDonationHost(u);
    u.searchParams.set(env.PLEDGE_SUBMISSION_FIELD_KEY, submissionId);
    // utm_content provides a second fallback the webhook can match on.
    u.searchParams.set("utm_content", submissionId);
    if (options?.intentToken) {
      // Duplicate onto both a dedicated field and mapping_key because
      // different Pledge surfaces preserve different metadata keys.
      u.searchParams.set("intent_token", options.intentToken);
      u.searchParams.set("mapping_key", options.intentToken);
    }
    return u.toString();
  } catch {
    return null;
  }
}

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
  options?: PledgeIntentOptions,
): string | null {
  return buildPledgeDonationUrl(
    submissionId,
    perPetUrl ?? env.PLEDGE_DEFAULT_DONATION_URL,
    options,
  );
}

// =====================================================================
// External checkout URL used by the secure vote-start redirect.
// =====================================================================
export function buildVoteCheckoutUrl(
  submissionId: string,
  perPetUrl: string | null,
  options?: PledgeIntentOptions,
): string | null {
  return buildPledgeDonationUrl(
    submissionId,
    perPetUrl ?? env.PLEDGE_DEFAULT_DONATION_URL,
    options,
  );
}

// =====================================================================
// Builds the secure in-app vote-start URL we send post-approval voters
// to. The route requires auth, records a vote intent, and then
// redirects out to Pledge.to with a signed token attached.
// =====================================================================
export function buildVoteDonationUrl(
  submissionId: string,
  perPetUrl: string | null,
): string | null {
  if (!(perPetUrl ?? env.PLEDGE_DEFAULT_DONATION_URL)) return null;
  return `/donate/vote/${submissionId}`;
}
