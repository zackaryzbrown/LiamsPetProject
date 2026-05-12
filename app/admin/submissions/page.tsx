import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApproveButton, DeleteButton } from "./_components/RowActions";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const admin = createAdminClient();

  let q = admin
    .from("pet_submissions")
    .select(
      "id, pet_name, owner_name, owner_email, status, total_votes, total_donated_cents, entry_donation_confirmed, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (statusFilter) {
    q = q.eq(
      "status",
      statusFilter as "pending_payment" | "pending_review" | "approved" | "rejected",
    );
  }
  const { data: rows } = await q;

  const filters: { value: string | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "pending_payment", label: "Awaiting donation" },
    { value: "pending_review", label: "Pending review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="grid gap-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl font-black tracking-tight">Submissions</h1>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/admin/submissions?status=${f.value}` : "/admin/submissions"}
              className={
                "rounded-full border-2 border-ink px-3 py-1 text-xs font-semibold " +
                ((statusFilter ?? undefined) === f.value
                  ? "bg-ink text-cream"
                  : "bg-white hover:bg-cream-200")
              }
            >
              {f.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="ink-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b-2 border-ink">
            <tr className="text-left">
              <th className="px-4 py-3">Pet</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Votes</th>
              <th className="px-4 py-3 text-right">Raised</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-ink/10">
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-semibold">{r.pet_name}</td>
                <td className="px-4 py-3">
                  {r.owner_name}
                  <div className="text-xs text-ink-muted">{r.owner_email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="cream">{r.status}</Badge>
                  {!r.entry_donation_confirmed && (
                    <span className="ml-2 text-xs text-ember-700">entry unpaid</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatNumber(r.total_votes)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(r.total_donated_cents)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/submissions/${r.id}`}>
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {r.status === "pending_review" && (
                      <ApproveButton submissionId={r.id} />
                    )}
                    <DeleteButton submissionId={r.id} petName={r.pet_name} />
                  </div>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  No submissions match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
