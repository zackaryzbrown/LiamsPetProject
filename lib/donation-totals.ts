import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Contest-wide raised total. Includes webhook-processed donations plus
// manual vote/amount corrections recorded by admins.
export async function getTotalRaisedCents(): Promise<number> {
  try {
    const admin = createAdminClient();
    const [{ data: donations, error: donationErr }, { data: manual, error: manualErr }] =
      await Promise.all([
        admin.from("pledge_donations").select("amount_cents"),
        admin.from("manual_vote_audit").select("amount_cents_delta"),
      ]);
    if (donationErr || !donations || manualErr || !manual) return 0;
    const donationTotal = donations.reduce(
      (sum, row) => sum + (row.amount_cents ?? 0),
      0,
    );
    const manualTotal = manual.reduce(
      (sum, row) => sum + (row.amount_cents_delta ?? 0),
      0,
    );
    return donationTotal + manualTotal;
  } catch {
    return 0;
  }
}
