"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AllocateResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const AllocationItemSchema = z.object({
  petId: z.string().uuid(),
  votes: z.coerce.number().int().min(1),
});
const AllocationsSchema = z
  .array(AllocationItemSchema)
  .min(1, "Pick at least one pet to vote for.");

// Computes the user's available credit pool: sum of credit rows minus all
// allocations the user has already made against them.
async function computeBalance(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  // Credits owned by this user (no pet attached, no parent).
  const { data: credits } = await adminClient
    .from("vote_transactions")
    .select("votes")
    .eq("donor_user_id", userId)
    .is("pet_submission_id", null)
    .is("parent_transaction_id", null);
  const totalCredits = (credits ?? []).reduce(
    (s, r) => s + ((r.votes as number) ?? 0),
    0,
  );

  // Allocations this user has made (children of their credit rows).
  const { data: spent } = await adminClient
    .from("vote_transactions")
    .select("votes")
    .eq("donor_user_id", userId)
    .not("parent_transaction_id", "is", null);
  const totalSpent = (spent ?? []).reduce(
    (s, r) => s + ((r.votes as number) ?? 0),
    0,
  );

  return { totalCredits, totalSpent, remaining: totalCredits - totalSpent };
}

export async function allocateVotes(
  raw: { petId: string; votes: number }[],
): Promise<AllocateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to vote." };

  const parsed = AllocationsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  // Coalesce duplicate pets in the request so the UI can be loose.
  const merged = new Map<string, number>();
  for (const item of parsed.data) {
    merged.set(item.petId, (merged.get(item.petId) ?? 0) + item.votes);
  }
  const total = [...merged.values()].reduce((s, n) => s + n, 0);
  if (total <= 0) return { ok: false, error: "Nothing to allocate." };

  const admin = createAdminClient();

  // Re-check balance server-side. Authoritative.
  const { remaining } = await computeBalance(admin, user.id);
  if (total > remaining) {
    return {
      ok: false,
      error: `You only have ${remaining} votes available; you tried to allocate ${total}.`,
    };
  }

  // Enforce that target pets are approved.
  const { data: pets } = await admin
    .from("pet_submissions")
    .select("id, status")
    .in("id", [...merged.keys()]);
  for (const id of merged.keys()) {
    const p = pets?.find((x) => x.id === id);
    if (!p || p.status !== "approved") {
      return { ok: false, error: "You can only vote for approved pets." };
    }
  }

  // Pick a credit row to attach allocations to (any of the user's credit rows
  // works for accounting; we pick the first as parent).
  const { data: credits } = await admin
    .from("vote_transactions")
    .select("id")
    .eq("donor_user_id", user.id)
    .is("pet_submission_id", null)
    .is("parent_transaction_id", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const parentId = credits?.[0]?.id as string | undefined;
  if (!parentId) {
    return { ok: false, error: "No credit balance found to draw from." };
  }

  const rows = [...merged.entries()].map(([petId, votes]) => ({
    pet_submission_id: petId,
    givebutter_transaction_id: `alloc:${user.id}:${petId}:${crypto.randomUUID()}`,
    kind: "vote" as const,
    amount_cents: votes * 100, // $1 = 1 vote
    votes,
    donor_user_id: user.id,
    parent_transaction_id: parentId,
    note: "Vote allocation from credit balance",
  }));

  const { error } = await admin.from("vote_transactions").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/account");
  revalidatePath("/vote");
  revalidatePath("/admin/leaderboard");

  return { ok: true, message: `Allocated ${total} vote${total === 1 ? "" : "s"}.` };
}
