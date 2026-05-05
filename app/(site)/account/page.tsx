import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/supabase/database.types";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

const STATUS_TONE: Record<SubmissionStatus, "ember" | "royal" | "cream" | "ink"> = {
  pending_payment: "ember",
  pending_review: "cream",
  approved: "royal",
  rejected: "ink",
};

const STATUS_HINT: Record<SubmissionStatus, string> = {
  pending_payment: "Complete the $10 entry donation to move forward.",
  pending_review: "Entry confirmed. Waiting for admin to approve your photo.",
  approved: "Live on the vote page. Share your link to collect votes.",
  rejected: "Not accepted. See the reason below.",
};

function publicImageUrl(path: string | null) {
  if (!path) return null;
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_BUCKET_PUBLIC}/${path}`;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  // Use admin client to read aggregated vote totals (RLS would hide other
  // people's vote rows, but we only ever query for this user's pets).
  const admin = createAdminClient();

  const { data: pets } = await admin
    .from("pet_submissions")
    .select(
      "id, pet_name, status, image_path, public_image_path, givebutter_member_url, rejection_reason, created_at, approved_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const petIds = (pets ?? []).map((p) => p.id as string);
  const { data: txns } = petIds.length
    ? await admin
        .from("vote_transactions")
        .select("pet_submission_id, votes, amount_cents")
        .in("pet_submission_id", petIds)
    : { data: [] as { pet_submission_id: string; votes: number; amount_cents: number }[] };

  const totalsByPet = new Map<string, { votes: number; cents: number }>();
  for (const t of txns ?? []) {
    const id = t.pet_submission_id as string;
    const cur = totalsByPet.get(id) ?? { votes: 0, cents: 0 };
    cur.votes += (t.votes as number) ?? 0;
    cur.cents += (t.amount_cents as number) ?? 0;
    totalsByPet.set(id, cur);
  }

  // Vote credits owned by this user (parent rows with no pet attached).
  const { data: creditRows } = await admin
    .from("vote_transactions")
    .select("votes")
    .eq("donor_user_id", user.id)
    .is("pet_submission_id", null)
    .is("parent_transaction_id", null);
  const totalCredits = (creditRows ?? []).reduce(
    (s, r) => s + ((r.votes as number) ?? 0),
    0,
  );
  // Allocations spent against those credits.
  const { data: spentRows } = await admin
    .from("vote_transactions")
    .select("votes")
    .eq("donor_user_id", user.id)
    .not("parent_transaction_id", "is", null);
  const alreadySpent = (spentRows ?? []).reduce(
    (s, r) => s + ((r.votes as number) ?? 0),
    0,
  );
  const remainingCredits = Math.max(0, totalCredits - alreadySpent);

  return (
    <section className="container py-12 md:py-16 max-w-4xl">
      <p className="eyebrow text-royal-700">Your account</p>
      <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
        Your pets &amp; votes
      </h1>
      <p className="mt-4 text-ink-muted max-w-2xl">
        Track your submissions and the votes they&apos;ve received. Votes come from public
        donations to your pet on Givebutter — <strong>$1 = 1 vote</strong>.
      </p>

      {totalCredits > 0 && (
        <Card className="mt-10 border-royal-700/40">
          <CardContent className="p-6 grid gap-4 sm:grid-cols-[1fr_auto] items-center">
            <div>
              <p className="eyebrow text-royal-700 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Your vote credits
              </p>
              <h2 className="mt-1 font-display text-3xl font-black">
                {remainingCredits} vote{remainingCredits === 1 ? "" : "s"} remaining
              </h2>
              <p className="text-sm text-ink-muted mt-1">
                {totalCredits} total · {alreadySpent} already cast. Spend them on the vote
                page — you can split across any approved pet.
              </p>
            </div>
            <Button asChild variant="ember" size="lg" disabled={remainingCredits === 0}>
              <Link href="/vote">
                Go vote <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 grid gap-6">
        {(pets ?? []).length === 0 && (
          <Card>
            <CardContent className="p-6 grid gap-3">
              <h2 className="font-display text-2xl font-black">No submissions yet</h2>
              <p className="text-ink-muted">
                Enter your pet to join the contest. The $10 entry donation kicks them off
                with 10 votes.
              </p>
              <div>
                <Button asChild variant="ember">
                  <Link href="/enter">
                    Enter your pet <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(pets ?? []).map((p) => {
          const status = p.status as SubmissionStatus;
          const totals = totalsByPet.get(p.id as string) ?? { votes: 0, cents: 0 };
          const url = publicImageUrl(p.public_image_path as string | null);
          return (
            <Card key={p.id as string}>
              <CardContent className="p-6 grid gap-5 sm:grid-cols-[160px_1fr]">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-ink bg-cream-200">
                  {url ? (
                    <Image
                      src={url}
                      alt={p.pet_name as string}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-ink-muted text-center px-2">
                      Photo not yet public
                    </div>
                  )}
                </div>
                <div className="grid gap-3 content-start">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h2 className="font-display text-3xl font-black">{p.pet_name as string}</h2>
                    <Badge tone={STATUS_TONE[status]}>{status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-ink-muted">{STATUS_HINT[status]}</p>

                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <Stat label="Votes received" value={formatNumber(totals.votes)} />
                    <Stat label="Donated to your pet" value={formatCurrency(totals.cents)} />
                  </div>

                  {status === "rejected" && p.rejection_reason && (
                    <div className="rounded-xl border-2 border-ember-500/30 bg-ember-50 p-3 text-sm">
                      <p className="eyebrow text-ember-500">Reason</p>
                      <p className="mt-1">{p.rejection_reason as string}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {status === "approved" && p.givebutter_member_url && (
                      <Button asChild variant="ember" size="sm">
                        <a
                          href={p.givebutter_member_url as string}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Share donation link <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {status === "approved" && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/vote">View on /vote</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-cream-100 p-3">
      <p className="eyebrow text-royal-700 text-[10px]">{label}</p>
      <p className="font-display text-2xl font-black mt-0.5">{value}</p>
    </div>
  );
}
