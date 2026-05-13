import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type DonationTypeFilter = "all" | "entry" | "vote" | "general";

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type, q } = await searchParams;
  const typeFilter: DonationTypeFilter =
    type === "entry" || type === "vote" || type === "general" ? type : "all";
  const search = (q ?? "").trim();

  const admin = createAdminClient();

  let query = admin
    .from("pledge_donations")
    .select(
      "id, donor_name, donor_email, amount_cents, tip_cents, fee_cents, currency, donation_type, vote_credits, created_at, processed_at, pet_submission_id, pledge_transaction_id, pledge_event_id",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (typeFilter !== "all") {
    query = query.eq("donation_type", typeFilter);
  }
  if (search) {
    // Match either donor name or email (case-insensitive contains).
    query = query.or(
      `donor_name.ilike.%${search}%,donor_email.ilike.%${search}%`,
    );
  }

  const { data: donations, error } = await query;
  if (error) {
    return (
      <section className="grid gap-3">
        <h1 className="font-display text-3xl font-black">Donations</h1>
        <p className="text-sm text-ember-700">{error.message}</p>
      </section>
    );
  }

  // Pull linked pet info (owner phone, pet name) in one shot.
  const petIds = Array.from(
    new Set(
      (donations ?? [])
        .map((d) => d.pet_submission_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const petMap = new Map<
    string,
    { pet_name: string; owner_name: string | null; owner_phone: string | null }
  >();
  if (petIds.length > 0) {
    const { data: pets } = await admin
      .from("pet_submissions")
      .select("id, pet_name, owner_name, owner_phone")
      .in("id", petIds);
    for (const p of pets ?? []) {
      petMap.set(p.id, {
        pet_name: p.pet_name,
        owner_name: p.owner_name,
        owner_phone: p.owner_phone,
      });
    }
  }

  const rows = donations ?? [];

  // Top-line stats for the currently filtered set.
  const totalCents = rows.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
  const totalDonors = new Set(
    rows.map((r) => (r.donor_email ?? "").toLowerCase()).filter(Boolean),
  ).size;

  return (
    <section className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-royal-700">Admin</p>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight">
            Donations
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Everything Pledge.to has reported back to us. Newest first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cream">
            {rows.length} {rows.length === 1 ? "donation" : "donations"}
          </Badge>
          <Badge tone="cream">{formatCurrency(totalCents)} total</Badge>
          <Badge tone="cream">
            {totalDonors} unique {totalDonors === 1 ? "donor" : "donors"}
          </Badge>
        </div>
      </header>

      {/* Filters */}
      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-ink bg-white p-3 shadow-card"
      >
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="flex-1 min-w-[200px] rounded-xl border-2 border-ink bg-cream-100 px-3 py-2 text-sm"
        />
        <select
          name="type"
          defaultValue={typeFilter}
          className="rounded-xl border-2 border-ink bg-cream-100 px-3 py-2 text-sm font-semibold"
        >
          <option value="all">All types</option>
          <option value="entry">Entry</option>
          <option value="vote">Per-pet vote</option>
          <option value="general">General</option>
        </select>
        <Button type="submit" variant="ember" size="sm">
          Apply
        </Button>
        {(search || typeFilter !== "all") && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/donations">Clear</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink bg-cream-100 p-8 text-center">
          <p className="font-display text-xl font-black">No donations yet.</p>
          <p className="mt-1 text-sm text-ink-muted">
            They&apos;ll show up here the moment Pledge.to&apos;s webhook fires.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-ink bg-white shadow-card">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b-2 border-ink bg-cream-100 text-left">
              <tr>
                <th className="px-3 py-3 font-display">When</th>
                <th className="px-3 py-3 font-display">Donor</th>
                <th className="px-3 py-3 font-display">Email</th>
                <th className="px-3 py-3 font-display">Phone</th>
                <th className="px-3 py-3 font-display text-right">Amount</th>
                <th className="px-3 py-3 font-display">Type</th>
                <th className="px-3 py-3 font-display">Pet</th>
                <th className="px-3 py-3 font-display">Pledge ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pet = r.pet_submission_id
                  ? petMap.get(r.pet_submission_id)
                  : null;
                const when = r.created_at
                  ? new Date(r.created_at).toLocaleString()
                  : "—";
                const tone =
                  r.donation_type === "entry"
                    ? "royal"
                    : r.donation_type === "vote"
                    ? "ember"
                    : "cream";
                return (
                  <tr key={r.id} className="border-t border-cream-200 align-top">
                    <td className="px-3 py-3 whitespace-nowrap text-ink-muted">
                      {when}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {r.donor_name || pet?.owner_name || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {r.donor_email ? (
                        <a
                          href={`mailto:${r.donor_email}`}
                          className="underline decoration-dotted underline-offset-2"
                        >
                          {r.donor_email}
                        </a>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {pet?.owner_phone ? (
                        <a
                          href={`tel:${pet.owner_phone}`}
                          className="underline decoration-dotted underline-offset-2"
                        >
                          {pet.owner_phone}
                        </a>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-display font-black">
                      {formatCurrency(r.amount_cents)}
                      {r.tip_cents > 0 && (
                        <div className="text-[10px] font-normal text-ink-muted">
                          +{formatCurrency(r.tip_cents)} tip
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={tone as "royal" | "ember" | "cream"}>
                        {r.donation_type}
                      </Badge>
                      {r.donation_type !== "entry" && r.vote_credits > 0 && (
                        <div className="mt-1 text-[10px] text-ink-muted">
                          {r.vote_credits} votes
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {pet ? (
                        <Link
                          href={`/admin/submissions/${r.pet_submission_id}`}
                          className="underline decoration-dotted underline-offset-2"
                        >
                          {pet.pet_name}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">General</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-ink-muted">
                      {r.pledge_transaction_id || r.pledge_event_id}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
