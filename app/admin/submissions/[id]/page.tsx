import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/supabase/database.types";
import { ChevronLeft } from "lucide-react";
import {
  ApproveCard,
  AddCreditsForm,
  ConfirmEntryCard,
  RejectCard,
  GivebutterLinksForm,
  ManualVoteForm,
  RemoveCard,
} from "./_components/Forms";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<SubmissionStatus, "ember" | "royal" | "cream" | "ink"> = {
  pending_review: "ember",
  approved: "royal",
  pending_payment: "cream",
  rejected: "ink",
};

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("pet_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  // Sign the private upload URL so we can preview it without making the
  // bucket public. Public bucket image (after approval) just uses the
  // public URL.
  let imageUrl: string | null = null;
  if (row.public_image_path) {
    imageUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_BUCKET_PUBLIC}/${row.public_image_path}`;
  } else if (row.image_path && row.image_path !== "pending") {
    const { data: signed } = await admin.storage
      .from(env.SUPABASE_BUCKET_UPLOADS)
      .createSignedUrl(row.image_path as string, 60 * 30);
    imageUrl = signed?.signedUrl ?? null;
  }

  const { data: txns } = await admin
    .from("vote_transactions")
    .select("id, kind, amount_cents, votes, donor_name, donor_email, note, created_at, givebutter_transaction_id")
    .eq("pet_submission_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const totals = (txns ?? []).reduce(
    (acc, t) => ({
      votes: acc.votes + ((t.votes as number) ?? 0),
      cents: acc.cents + ((t.amount_cents as number) ?? 0),
    }),
    { votes: 0, cents: 0 },
  );

  const status = row.status as SubmissionStatus;

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin/submissions"
          className="inline-flex items-center text-sm text-ink-muted hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to submissions
        </Link>
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow text-royal-700">Submission</p>
            <h1 className="font-display text-4xl font-black">{row.pet_name as string}</h1>
            <p className="text-ink-muted mt-1">
              {row.owner_name as string} · {row.owner_email as string}
              {row.owner_phone ? ` · ${row.owner_phone as string}` : ""}
            </p>
          </div>
          <Badge tone={STATUS_TONE[status]}>{status.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardContent className="p-4">
            {imageUrl ? (
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-ink bg-cream-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={row.pet_name as string} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square grid place-items-center rounded-xl border-2 border-dashed border-ink/40 text-ink-muted">
                No photo uploaded
              </div>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm mt-4">
              <Meta label="Submission ID" value={(row.id as string).slice(0, 8) + "…"} mono />
              <Meta
                label="Created"
                value={new Date(row.created_at as string).toLocaleString()}
              />
              {row.approved_at && (
                <Meta
                  label="Approved"
                  value={new Date(row.approved_at as string).toLocaleString()}
                />
              )}
              {row.rejected_at && (
                <Meta
                  label="Rejected"
                  value={new Date(row.rejected_at as string).toLocaleString()}
                />
              )}
              <Meta
                label="Entry donation"
                value={row.entry_donation_confirmed ? "Confirmed" : "Not confirmed"}
              />
              <Meta label="Consent (public)" value={row.consent_public_display ? "Yes" : "No"} />
            </dl>
            {row.rejection_reason && (
              <div className="mt-3 p-3 rounded-xl bg-ember-50 border-2 border-ember-500/20">
                <p className="eyebrow text-ember-500">Rejection reason</p>
                <p className="text-sm mt-1">{row.rejection_reason as string}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {status === "pending_payment" && (
            <ConfirmEntryCard submissionId={row.id as string} />
          )}
          {status === "pending_review" || status === "approved" ? (
            <ApproveCard submissionId={row.id as string} alreadyApproved={status === "approved"} />
          ) : null}

          {status !== "rejected" && <RejectCard submissionId={row.id as string} />}

          <Card>
            <CardContent className="p-6 grid gap-4">
              <div>
                <p className="eyebrow text-royal-700">Givebutter links</p>
                <h2 className="font-display text-2xl font-black">Vote / member URL</h2>
                <p className="text-sm text-ink-muted">
                  These are shown on the public vote page so supporters can donate to this pet.
                </p>
              </div>
              <GivebutterLinksForm
                submissionId={row.id as string}
                memberUrl={(row.givebutter_member_url as string | null) ?? ""}
                memberId={(row.givebutter_member_id as string | null) ?? ""}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 grid gap-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow text-royal-700">Votes</p>
                  <h2 className="font-display text-2xl font-black">
                    {totals.votes.toLocaleString()} votes ·{" "}
                    {formatCurrency(totals.cents)}
                  </h2>
                </div>
              </div>
              <ManualVoteForm submissionId={row.id as string} />
              <AddCreditsForm submissionId={row.id as string} />
              {(txns?.length ?? 0) > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-ink-muted">
                      <tr>
                        <th className="py-1 pr-3 font-semibold">When</th>
                        <th className="py-1 pr-3 font-semibold">Kind</th>
                        <th className="py-1 pr-3 font-semibold">Donor</th>
                        <th className="py-1 pr-3 font-semibold text-right">Amount</th>
                        <th className="py-1 pl-3 font-semibold text-right">Votes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(txns ?? []).map((t) => (
                        <tr key={t.id as string} className="border-t border-ink/10">
                          <td className="py-1 pr-3">
                            {new Date(t.created_at as string).toLocaleDateString()}
                          </td>
                          <td className="py-1 pr-3 capitalize">{t.kind as string}</td>
                          <td className="py-1 pr-3 truncate max-w-[16ch]">
                            {(t.donor_name as string) ?? "-"}
                          </td>
                          <td className="py-1 pr-3 text-right">
                            {formatCurrency(t.amount_cents as number)}
                          </td>
                          <td className="py-1 pl-3 text-right">
                            {(t.votes as number).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <RemoveCard submissionId={row.id as string} petName={row.pet_name as string} />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-widest text-ink-muted">{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  );
}
