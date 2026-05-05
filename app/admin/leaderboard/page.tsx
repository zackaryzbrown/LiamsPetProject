import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pet_leaderboard")
    .select("id, pet_name, owner_name, total_votes, total_amount_cents, approved_at, givebutter_member_url");

  // The view doesn't sort by votes; sort here so admins can spot drift.
  const rows = [...(data ?? [])].sort(
    (a, b) => ((b.total_votes as number) ?? 0) - ((a.total_votes as number) ?? 0),
  );

  const totals = rows.reduce(
    (acc, r) => ({
      votes: acc.votes + ((r.total_votes as number) ?? 0),
      cents: acc.cents + ((r.total_amount_cents as number) ?? 0),
    }),
    { votes: 0, cents: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-royal-700">Leaderboard</p>
          <h1 className="font-display text-4xl font-black">Vote totals</h1>
          <p className="text-ink-muted mt-1">
            Computed from <code>vote_transactions</code>. Use the per-pet page to record manual
            adjustments if Givebutter sync fails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="royal">{totals.votes.toLocaleString()} votes</Badge>
          <Badge tone="ember">{formatCurrency(totals.cents)} raised</Badge>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6 text-ember-500">
            Failed to load leaderboard: {error.message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-muted bg-cream-100 border-b-2 border-ink">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Pet</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold text-right">Votes</th>
                <th className="px-4 py-3 font-semibold text-right">Raised</th>
                <th className="px-4 py-3 font-semibold">Givebutter</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id as string} className="border-b border-ink/10">
                  <td className="px-4 py-3 font-display font-black">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold">{r.pet_name as string}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.owner_name as string}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {((r.total_votes as number) ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency((r.total_amount_cents as number) ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    {r.givebutter_member_url ? (
                      <a
                        href={r.givebutter_member_url as string}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-royal-700"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-ink-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/submissions/${r.id}`}>Edit</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-ink-muted" colSpan={7}>
                    No approved pets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
