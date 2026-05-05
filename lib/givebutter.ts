import { env } from "./env";

// Builds the URL we send users to after a successful submission for the
// $10 entry donation. We attach our submission_id so the webhook can match
// the donation back to the row.
//
// TODO: Confirm exactly how Givebutter exposes the custom field on the
// hosted checkout. Most plans accept query params on the hosted donation
// page that pre-fill custom fields keyed by their internal slug. The key
// name is configurable via GIVEBUTTER_SUBMISSION_FIELD_KEY.
export function buildEntryDonationUrl(submissionId: string): string | null {
  if (!env.GIVEBUTTER_ENTRY_CHECKOUT_URL) return null;
  const u = new URL(env.GIVEBUTTER_ENTRY_CHECKOUT_URL);
  u.searchParams.set(env.GIVEBUTTER_SUBMISSION_FIELD_KEY, submissionId);
  // Optional: many Givebutter campaigns support a 'utm_content' fallback we
  // can also key off of. Setting it here gives the webhook two ways to match.
  u.searchParams.set("utm_content", submissionId);
  return u.toString();
}
