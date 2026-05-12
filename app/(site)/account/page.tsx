import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildVoteDonationUrl } from "@/lib/pledge";
import { env } from "@/lib/env";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getCreditBalanceCents, getCreditHistory } from "@/lib/user-credits";
import { SpendCreditsCard } from "./_components/SpendCreditsCard";
import { ArrowUpRight, ExternalLink, Wallet } from "lucide-react";
import Image from "next/image";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

type StatusTone = "ember" | "ink" | "cream" | "royal";

function statusBadge(status: string): { tone: StatusTone; label: string } {
  switch (status) {
    case "pending_payment":
      return { tone: "ember", label: "Awaiting donation" };
    case "pending_review":
      return { tone: "royal", label: "Pending review" };
    case "approved":
      return { tone: "ink", label: "Approved" };
    case "rejected":
      return { tone: "cream", label: "Rejected" };
    default:
      return { tone: "cream", label: status };
  }
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  // Use the admin client for storage URL signing only — pet rows come
  // through RLS so the user only sees their own submissions.
  const admin = createAdminClient();
  const [{ data: pets }, balanceCents, history, approvedPets] = await Promise.all([
    supabase
      .from("pet_submissions")
      .select(
        "id, pet_name, status, image_path, public_image_path, total_votes, total_donated_cents, pledge_donation_url, entry_donation_confirmed, rejection_reason, created_at",
      )
      .order("created_at", { ascending: false }),
    getCreditBalanceCents(user.id),
    getCreditHistory(user.id),
    // Approved pets are public, so the anon client can read them.
    supabase
      .from("pet_submissions")
      .select("id, pet_name")
      .eq("status", "approved")
      .order("pet_name", { ascending: true }),
  ]);
  const approvedOptions = (approvedPets.data ?? []).map((p) => ({
    id: p.id as string,
    name: p.pet_name as string,
  }));

  const myPets = (pets ?? []).map((p) => {
    const imageUrl = p.public_image_path
      ? admin.storage.from(env.SUPABASE_BUCKET_PUBLIC).getPublicUrl(p.public_image_path).data
          .publicUrl
      : null;
    return {
      ...p,
      imageUrl,
      voteUrl:
        p.status === "approved"
          ? buildVoteDonationUrl(p.id, p.pledge_donation_url)
          : null,
    };
  });

  return (
    <section className="container py-12 md:py-16 max-w-5xl">
      <p className="eyebrow text-royal-700">Account</p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl font-black tracking-tight">
        Your submissions.
      </h1>
      <p className="mt-3 text-ink-muted">{user.email}</p>

      {/*
        Vote-credit wallet. Filled when an entry donation exceeds the
        $10 entry fee — the overage is credited here for the entrant to
        spend on any approved pet. Lifetime activity from the ledger is
        shown below the spend form so the user can audit deposits and
        spends.
      */}
      <div className="mt-10 grid gap-5 md:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="p-6 grid gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-royal-700">
              <Wallet className="h-4 w-4" />
              Vote credit wallet
            </div>
            <p className="font-display text-4xl font-black tracking-tight">
              {formatCurrency(balanceCents)}
            </p>
            <p className="text-sm text-ink-muted">
              {formatNumber(Math.floor(balanceCents / 100))} vote
              {Math.floor(balanceCents / 100) === 1 ? "" : "s"} ready to spend.
              Credits come from entry donations over the $10 entry fee.
            </p>
          </CardContent>
        </Card>
        <SpendCreditsCard
          balanceCents={balanceCents}
          pets={approvedOptions}
        />
      </div>

      {history.length > 0 && (
        <Card className="mt-5">
          <CardContent className="p-6 grid gap-3">
            <p className="font-display text-xl font-black tracking-tight">
              Wallet activity
            </p>
            <ul className="divide-y-2 divide-cream-200">
              {history.map((row) => {
                const positive = row.delta_cents > 0;
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {positive
                          ? row.reason === "entry_overage"
                            ? "Entry donation overage"
                            : (row.reason ?? "Credit")
                          : `Voted for ${row.pet_name ?? "a pet"}`}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {new Date(row.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`font-display text-lg font-black ${
                        positive ? "text-royal-700" : "text-ember-700"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {formatCurrency(Math.abs(row.delta_cents))}
                    </p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-10 grid gap-5">
        {myPets.length === 0 && (
          <Card>
            <CardContent className="p-8 grid gap-4 text-center">
              <p className="font-display text-2xl font-black">No submissions yet.</p>
              <p className="text-ink-muted">Enter your first pet to get on the leaderboard.</p>
              <div className="flex justify-center">
                <Button asChild variant="ember" size="lg">
                  <Link href="/enter">Enter your pet</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {myPets.map((p) => {
          const status = statusBadge(p.status);
          return (
            <Card key={p.id}>
              <CardContent className="p-5 md:p-6 grid gap-5 md:grid-cols-[120px_1fr_auto] items-center">
                <div className="relative h-28 w-28 md:h-32 md:w-32 rounded-2xl border-2 border-ink overflow-hidden bg-cream-200 shrink-0 mx-auto md:mx-0">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.pet_name} fill sizes="128px" className="object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-xs text-ink-muted text-center px-2">
                      Photo pending approval
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-2xl font-black tracking-tight">{p.pet_name}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  {p.status === "approved" && (
                    <p className="text-sm text-ink-muted">
                      <strong>{formatNumber(p.total_votes)}</strong> votes ·{" "}
                      <strong>{formatCurrency(p.total_donated_cents)}</strong> raised
                    </p>
                  )}
                  {p.status === "pending_payment" && !p.entry_donation_confirmed && (
                    <p className="text-sm text-ink-muted">
                      Complete the $10 entry donation on Pledge.to to move this pet into review.
                    </p>
                  )}
                  {p.status === "rejected" && p.rejection_reason && (
                    <p className="text-sm text-ember-700">Rejected: {p.rejection_reason}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {p.voteUrl && (
                    <Button asChild variant="ember" size="sm">
                      <a href={p.voteUrl} target="_blank" rel="noopener noreferrer">
                        Share donation link <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  {p.status === "approved" && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/vote">
                        View on leaderboard <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
