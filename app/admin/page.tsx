import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Inbox, Trophy, Settings, AlertTriangle, GitMerge } from "lucide-react";

export const dynamic = "force-dynamic";

async function loadStats() {
  const admin = createAdminClient();
  const [pendingReview, pendingPayment, approved, rejected, leaderboard, settings, unmatched] =
    await Promise.all([
      admin.from("pet_submissions").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      admin.from("pet_submissions").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
      admin.from("pet_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
      admin.from("pet_submissions").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      admin.from("pet_leaderboard").select("total_amount_cents, total_votes"),
      admin.from("contest_settings").select("contest_open, goal_amount_cents, submission_deadline, voting_deadline").eq("id", 1).maybeSingle(),
      admin.from("webhook_events_raw").select("id", { count: "exact", head: true }).eq("matched", false),
    ]);
  const totalCents = (leaderboard.data ?? []).reduce(
    (sum, r) => sum + ((r.total_amount_cents as number) ?? 0),
    0,
  );
  const totalVotes = (leaderboard.data ?? []).reduce(
    (sum, r) => sum + ((r.total_votes as number) ?? 0),
    0,
  );
  return {
    counts: {
      pendingReview: pendingReview.count ?? 0,
      pendingPayment: pendingPayment.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      unmatched: unmatched.count ?? 0,
    },
    totalCents,
    totalVotes,
    settings: settings.data,
  };
}

export default async function AdminHome() {
  const { counts, totalCents, totalVotes, settings } = await loadStats();
  const goalCents = settings?.goal_amount_cents ?? 0;
  const goalPct = goalCents > 0 ? Math.min(100, Math.round((totalCents / goalCents) * 100)) : 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-royal-700">Overview</p>
          <h1 className="font-display text-4xl font-black">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={settings?.contest_open ? "royal" : "ember"}>
            {settings?.contest_open ? "Contest open" : "Contest closed"}
          </Badge>
          <Button asChild variant="ink" size="sm">
            <Link href="/admin/settings">Edit</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Awaiting review" value={counts.pendingReview} accent="ember" href="/admin/submissions?status=pending_review" />
        <Stat label="Awaiting payment" value={counts.pendingPayment} href="/admin/submissions?status=pending_payment" />
        <Stat label="Approved" value={counts.approved} href="/admin/submissions?status=approved" />
        <Stat label="Rejected" value={counts.rejected} href="/admin/submissions?status=rejected" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <p className="eyebrow text-royal-700">Raised so far</p>
            <p className="mt-2 font-display text-4xl font-black">{formatCurrency(totalCents)}</p>
            {goalCents > 0 && (
              <p className="mt-1 text-sm text-ink-muted">
                {goalPct}% of {formatCurrency(goalCents)} goal
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="eyebrow text-royal-700">Total votes</p>
            <p className="mt-2 font-display text-4xl font-black">{formatNumber(totalVotes)}</p>
            <p className="mt-1 text-sm text-ink-muted">Across all approved pets</p>
          </CardContent>
        </Card>
      </div>

      {counts.pendingReview > 0 && (
        <Card>
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-ember-500 mt-0.5" />
              <div>
                <p className="font-display text-xl font-black">
                  {counts.pendingReview} submission{counts.pendingReview === 1 ? "" : "s"} awaiting review
                </p>
                <p className="text-sm text-ink-muted">
                  Owners completed the entry donation. Review and approve to publish.
                </p>
              </div>
            </div>
            <Button asChild variant="ember">
              <Link href="/admin/submissions?status=pending_review">
                <Inbox className="h-4 w-4" /> Review now
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {counts.unmatched > 0 && (
        <Card>
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <GitMerge className="h-5 w-5 text-ember-500 mt-0.5" />
              <div>
                <p className="font-display text-xl font-black">
                  {counts.unmatched} unmatched webhook event{counts.unmatched === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-ink-muted">
                  Donations that we couldn&apos;t auto-link to a pet. Reconcile so vote totals stay accurate.
                </p>
              </div>
            </div>
            <Button asChild variant="ember">
              <Link href="/admin/reconciliation">Reconcile</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <QuickLink href="/admin/leaderboard" icon={Trophy} label="Leaderboard" desc="See vote totals and adjust if Givebutter sync drifts." />
        <QuickLink href="/admin/reconciliation" icon={GitMerge} label="Reconciliation" desc="Match unlinked donations to pets." />
        <QuickLink href="/admin/settings" icon={Settings} label="Contest settings" desc="Open/close the contest, set deadlines and goal." />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent?: "ember";
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:-translate-y-0.5 transition-transform">
        <CardContent className="p-5">
          <p className="eyebrow text-royal-700">{label}</p>
          <p
            className={`mt-2 font-display text-4xl font-black ${
              accent === "ember" && value > 0 ? "text-ember-500" : ""
            }`}
          >
            {formatNumber(value)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:-translate-y-0.5 transition-transform">
        <CardContent className="p-5 flex items-start gap-3">
          <Icon className="h-5 w-5 text-royal-700 mt-1" />
          <div>
            <p className="font-display text-xl font-black">{label}</p>
            <p className="text-sm text-ink-muted">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
