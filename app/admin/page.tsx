import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, Trophy, GitMerge, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [{ data: pets }, pending, unmapped] = await Promise.all([
    admin
      .from("pet_submissions")
      .select("status, total_votes, total_donated_cents"),
    admin
      .from("pet_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    admin
      .from("pledge_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("processing_status", "unmapped"),
  ]);

  const approved = (pets ?? []).filter((p) => p.status === "approved");
  const raisedCents = approved.reduce(
    (sum, p) => sum + (p.total_donated_cents ?? 0),
    0,
  );
  const votes = approved.reduce((sum, p) => sum + (p.total_votes ?? 0), 0);

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="font-display text-3xl font-black tracking-tight">Overview</h1>
        <p className="text-ink-muted">
          Live totals across approved pets — donations come from the Pledge.to webhook.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow text-royal-700">Total raised</p>
            <p className="mt-2 font-display text-4xl font-black tabular-nums">
              {formatCurrency(raisedCents)}
            </p>
            <p className="mt-1 text-sm text-ink-muted">Sum of approved pets&apos; donations.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow text-royal-700">Total votes</p>
            <p className="mt-2 font-display text-4xl font-black tabular-nums">
              {formatNumber(votes)}
            </p>
            <p className="mt-1 text-sm text-ink-muted">$1 = 1 vote (webhook + audit).</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow text-royal-700">Approved pets</p>
            <p className="mt-2 font-display text-4xl font-black tabular-nums">
              {formatNumber(approved.length)}
            </p>
            <p className="mt-1 text-sm text-ink-muted">Visible on /vote.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5 grid gap-3">
            <div className="flex items-center gap-3">
              <Inbox className="h-5 w-5 text-royal-700" />
              <p className="font-display text-xl font-black">Pending review</p>
              <Badge tone="ember">{pending.count ?? 0}</Badge>
            </div>
            <p className="text-sm text-ink-muted">
              Pets that have paid their entry donation and are waiting on admin photo approval.
            </p>
            <Button asChild variant="ember" size="sm">
              <Link href="/admin/submissions?status=pending_review">
                Review <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 grid gap-3">
            <div className="flex items-center gap-3">
              <GitMerge className="h-5 w-5 text-royal-700" />
              <p className="font-display text-xl font-black">Unmapped donations</p>
              <Badge tone="ember">{unmapped.count ?? 0}</Badge>
            </div>
            <p className="text-sm text-ink-muted">
              Pledge.to donations the webhook could not assign to a pet. Map them manually.
            </p>
            <Button asChild variant="ember" size="sm">
              <Link href="/admin/reconciliation">
                Reconcile <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 grid gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-royal-700" />
            <p className="font-display text-xl font-black">Leaderboard</p>
          </div>
          <p className="text-sm text-ink-muted">
            See the full ranking and per-pet totals.
          </p>
          <Button asChild variant="ghost" size="sm" className="justify-self-start">
            <Link href="/admin/leaderboard">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
