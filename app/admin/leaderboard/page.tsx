import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTotalRaisedCents } from "@/lib/donation-totals";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLeaderboardPage() {
  const admin = createAdminClient();
  const [{ data: pets }, totalRaised] = await Promise.all([
    admin
      .from("pet_submissions")
      .select(
        "id, pet_name, owner_name, total_votes, manual_vote_adjustment, total_donated_cents, pledge_donation_url",
      )
      .eq("status", "approved")
      .order("total_votes", { ascending: false })
      .limit(500),
    getTotalRaisedCents(),
  ]);

  const totalVotes = (pets ?? []).reduce((s, p) => s + (p.total_votes ?? 0), 0);

  return (
    <div className="grid gap-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Leaderboard</h1>
          <p className="text-ink-muted">
            Approved pets ranked by total votes. Updated by the Pledge.to webhook in real time.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="cream">{formatNumber(totalVotes)} votes</Badge>
          <Badge tone="ink">{formatCurrency(totalRaised)} raised</Badge>
        </div>
      </header>

      <div className="ink-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b-2 border-ink">
            <tr className="text-left">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Pet</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3 text-right">Votes</th>
              <th className="px-4 py-3 text-right">Manual</th>
              <th className="px-4 py-3 text-right">Raised</th>
              <th className="px-4 py-3">Donation URL</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-ink/10">
            {(pets ?? []).map((p, i) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-display font-black tabular-nums">{i + 1}</td>
                <td className="px-4 py-3 font-semibold">{p.pet_name}</td>
                <td className="px-4 py-3">{p.owner_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatNumber(p.total_votes)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p.manual_vote_adjustment >= 0 ? "+" : ""}
                  {p.manual_vote_adjustment}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(p.total_donated_cents)}
                </td>
                <td className="px-4 py-3 max-w-xs truncate">
                  {p.pledge_donation_url ? (
                    <a
                      href={p.pledge_donation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-royal-700"
                    >
                      {p.pledge_donation_url}
                    </a>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/submissions/${p.id}`}>
                      Open <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {(!pets || pets.length === 0) && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-muted">
                  No approved pets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
