import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Contest-wide raised total. Includes pet-linked donations AND general
// campaign gifts that were processed by the webhook but didn't map to a
// specific pet.
export async function getTotalRaisedCents(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("pledge_donations").select("amount_cents");
    if (error || !data) return 0;
    return data.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  } catch {
    return 0;
  }
}
