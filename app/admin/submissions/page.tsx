import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApproveButton, DeleteButton } from "./_components/RowActions";
import { formatCurrency } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/supabase/database.types";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUSES: { value: SubmissionStatus | "all"; label: string }[] = [
  { value: "pending_review", label: "Awaiting review" },
  { value: "approved", label: "Approved" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const STATUS_TONE: Record<SubmissionStatus, "ember" | "royal" | "cream" | "ink"> = {
  pending_review: "ember",
  approved: "royal",
  pending_payment: "cream",
  rejected: "ink",
};

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter = (sp.status ?? "pending_review") as SubmissionStatus | "all";
  const admin = createAdminClient();

  let query = admin
    .from("pet_submissions")
    .select(
      "id, pet_name, owner_name, owner_email, status, image_path, public_image_path, created_at, approved_at, rejected_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter !== "all") query = query.eq("status", filter);
  const { data: rows, error } = await query;

  // Fetch per-pet totals from leaderboard view (approved pets only carry totals).
  const ids = (rows ?? []).map((r) => r.id as string);
  const totals = new Map<string, { votes: number; cents: number }>();
  if (ids.length) {
    const { data: lb } = await admin
      .from("pet_leaderboard")
      .select("id, total_votes, total_amount_cents")
      .in("id", ids);
    for (const r of lb ?? []) {
      totals.set(r.id as string, {
        votes: (r.total_votes as number) ?? 0,
        cents: (r.total_amount_cents as number) ?? 0,
      });
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow text-royal-700">Submissions</p>
        <h1 className="font-display text-4xl font-black">Pet submissions</h1>
      </div>

      <nav className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const active = (filter as string) === s.value;
          return (
            <Link
              key={s.value}
              href={`/admin/submissions?status=${s.value}`}
              className={`px-3 py-1.5 rounded-full border-2 border-ink text-sm font-semibold ${
                active ? "bg-ink text-cream" : "bg-white hover:bg-cream-200"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      {error && (
        <Card>
          <CardContent className="p-6 text-ember-500">
            Failed to load submissions: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && (rows?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-ink-muted">
            No submissions in this view yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {(rows ?? []).map((r) => {
          const t = totals.get(r.id as string);
          const status = r.status as SubmissionStatus;
          return (
            <Card key={r.id as string}>
              <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/submissions/${r.id}`}
                      className="font-display text-xl font-black hover:underline truncate"
                    >
                      {r.pet_name as string}
                    </Link>
                    <Badge tone={STATUS_TONE[status]}>{status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-ink-muted truncate">
                    {r.owner_name as string} · {r.owner_email as string}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Submitted {new Date(r.created_at as string).toLocaleString()}
                  </p>
                </div>

                {status === "approved" && t && (
                  <div className="text-right">
                    <p className="font-display text-lg font-black">
                      {t.votes.toLocaleString()} votes
                    </p>
                    <p className="text-xs text-ink-muted">{formatCurrency(t.cents)} raised</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {status === "pending_review" && (
                    <ApproveButton submissionId={r.id as string} />
                  )}
                  <Button asChild variant="ink" size="sm">
                    <Link href={`/admin/submissions/${r.id}`}>
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <DeleteButton submissionId={r.id as string} petName={r.pet_name as string} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
