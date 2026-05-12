import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ApproveCard,
  ConfirmEntryCard,
  ManualVoteForm,
  PledgeLinksForm,
  RejectCard,
  RemoveCard,
} from "./_components/Forms";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: pet, error } = await admin
    .from("pet_submissions")
    .select(
      "id, pet_name, owner_name, owner_email, owner_phone, status, image_path, public_image_path, total_votes, manual_vote_adjustment, total_donated_cents, entry_donation_confirmed, rejection_reason, pledge_donation_url, pledge_widget_id, pledge_campaign_id, pledge_mapping_key, entry_pledge_transaction_id, created_at, approved_at, rejected_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !pet) notFound();

  const imageUrl =
    pet.image_path && pet.image_path !== "pending"
      ? (await admin.storage
          .from(env.SUPABASE_BUCKET_UPLOADS)
          .createSignedUrl(pet.image_path, 60 * 10)).data?.signedUrl ?? null
      : null;

  const [{ data: donations }, { data: audit }] = await Promise.all([
    admin
      .from("pledge_donations")
      .select(
        "id, amount_cents, tip_cents, fee_cents, donor_name, donor_email, donation_type, pledge_event_id, pledge_transaction_id, created_at",
      )
      .eq("pet_submission_id", pet.id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("manual_vote_audit")
      .select(
        "id, amount_cents_delta, votes_delta, previous_total, new_total, reason, admin_user_id, created_at",
      )
      .eq("pet_submission_id", pet.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="grid gap-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/submissions">
            <ArrowLeft className="h-3.5 w-3.5" /> All submissions
          </Link>
        </Button>
        <h1 className="mt-4 font-display text-4xl font-black tracking-tight">
          {pet.pet_name}
        </h1>
        <p className="mt-1 text-ink-muted">
          with {pet.owner_name} · {pet.owner_email}
          {pet.owner_phone ? ` · ${pet.owner_phone}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="ink">Status: {pet.status}</Badge>
          <Badge tone="cream">{formatNumber(pet.total_votes)} votes</Badge>
          <Badge tone="cream">{formatCurrency(pet.total_donated_cents)} raised</Badge>
          {pet.entry_donation_confirmed && <Badge tone="royal">Entry confirmed</Badge>}
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <div className="ink-card p-3">
          <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-ink bg-cream-200">
            {imageUrl ? (
              <Image src={imageUrl} alt={pet.pet_name} fill sizes="280px" className="object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-sm text-ink-muted">
                No photo uploaded
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <PledgeLinksForm
            submissionId={pet.id}
            initial={{
              pledgeDonationUrl: pet.pledge_donation_url,
              pledgeWidgetId: pet.pledge_widget_id,
              pledgeCampaignId: pet.pledge_campaign_id,
              pledgeMappingKey: pet.pledge_mapping_key,
            }}
          />

          <div className="grid md:grid-cols-2 gap-4">
            {pet.status !== "approved" && <ApproveCard submissionId={pet.id} />}
            {pet.status !== "rejected" && <RejectCard submissionId={pet.id} />}
            {!pet.entry_donation_confirmed && <ConfirmEntryCard submissionId={pet.id} />}
          </div>

          <ManualVoteForm submissionId={pet.id} />

          <RemoveCard submissionId={pet.id} petName={pet.pet_name} />
        </div>
      </div>

      <section className="ink-card overflow-hidden">
        <header className="p-5 border-b-2 border-ink bg-ink text-cream flex items-baseline justify-between">
          <h2 className="font-display text-xl font-black">Pledge.to donations</h2>
          <p className="text-xs uppercase tracking-widest text-cream/70">
            {donations?.length ?? 0} record(s)
          </p>
        </header>
        {donations && donations.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b-2 border-ink">
              <tr className="text-left">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Donor</th>
                <th className="px-4 py-2">Event ID</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-ink/10">
              {donations.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone="cream">{d.donation_type}</Badge>
                  </td>
                  <td className="px-4 py-2 font-semibold tabular-nums">
                    {formatCurrency(d.amount_cents)}
                    {d.tip_cents > 0 && (
                      <span className="ml-2 text-xs text-ink-muted">
                        +{formatCurrency(d.tip_cents)} tip
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {d.donor_name ?? "—"}
                    <div className="text-xs text-ink-muted">{d.donor_email ?? ""}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs break-all">{d.pledge_event_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-center text-ink-muted">No Pledge.to donations recorded yet.</p>
        )}
      </section>

      <section className="ink-card overflow-hidden">
        <header className="p-5 border-b-2 border-ink bg-ink text-cream flex items-baseline justify-between">
          <h2 className="font-display text-xl font-black">Manual adjustments</h2>
          <p className="text-xs uppercase tracking-widest text-cream/70">
            {audit?.length ?? 0} record(s)
          </p>
        </header>
        {audit && audit.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b-2 border-ink">
              <tr className="text-left">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Delta</th>
                <th className="px-4 py-2">Votes</th>
                <th className="px-4 py-2">Totals</th>
                <th className="px-4 py-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-ink/10">
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-semibold tabular-nums">
                    {a.amount_cents_delta >= 0 ? "+" : ""}
                    {formatCurrency(a.amount_cents_delta)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {a.votes_delta >= 0 ? "+" : ""}
                    {a.votes_delta}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {a.previous_total} → <strong>{a.new_total}</strong>
                  </td>
                  <td className="px-4 py-2">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-center text-ink-muted">No manual adjustments yet.</p>
        )}
      </section>
    </div>
  );
}
