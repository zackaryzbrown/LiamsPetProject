import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PetCard } from "@/components/PetCard";
import { Leaderboard } from "@/components/Leaderboard";
import { ContestStatusBadge } from "@/components/ContestStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { getApprovedPets, getPublicContest } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/server";
import { getCreditBalanceCents } from "@/lib/user-credits";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "Vote with a donation" };
export const dynamic = "force-dynamic";

export default async function VotePage() {
  const supabase = await createClient();
  const [contest, pets, { data: { user } }] = await Promise.all([
    getPublicContest(),
    getApprovedPets(),
    supabase.auth.getUser(),
  ]);
  const userEmail = user?.email ?? null;
  const creditBalanceCents = user ? await getCreditBalanceCents(user.id) : 0;

  const c = contest ?? {
    contestOpen: false,
    submissionsOpen: false,
    votingOpen: false,
    votingDeadline: new Date().toISOString(),
    submissionDeadline: new Date().toISOString(),
    goalAmountCents: 0,
    raisedAmountCents: 0,
  };
  const votingIsOpen =
    c.votingOpen && new Date(c.votingDeadline).getTime() > Date.now();
  const pct =
    c.goalAmountCents > 0
      ? Math.min(100, Math.round((c.raisedAmountCents / c.goalAmountCents) * 100))
      : 0;

  return (
    <>
      <section className="container py-12 md:py-16">
        <header className="max-w-3xl">
          <p className="eyebrow text-royal-700">Vote with a donation</p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
            Pick a pet. <span className="italic text-ember-500">Donate.</span> Vote.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-muted">
            Every dollar you donate to a pet on Pledge.to counts as one vote. 100% of donations
            support <strong>Soul Dog Rescue</strong>.
          </p>
          <ContestStatusBadge
            contestOpen={votingIsOpen}
            votingDeadline={c.votingDeadline}
            className="mt-5"
          />
          {!votingIsOpen && (
            <p className="mt-4 max-w-xl rounded-xl border-2 border-ink bg-cream-100 px-4 py-3 text-sm text-ink-muted">
              Voting is currently closed. You can still view pets and standings.
            </p>
          )}
          {!contest && (
            <p className="mt-3 max-w-xl rounded-xl border-2 border-ember-500 bg-ember-50 px-4 py-3 text-sm text-ember-700">
              Live contest totals are temporarily unavailable.
            </p>
          )}
        </header>

        {/* Slim inline fundraiser progress — same DNA as hero strip. */}
        <div
          className="mt-10 max-w-3xl"
          role="group"
          aria-label="Fundraiser progress"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-display">
              <span className="text-2xl md:text-3xl font-black">
                {formatCurrency(c.raisedAmountCents)}
              </span>
              <span className="ml-2 text-ink-muted text-base md:text-lg font-semibold">
                raised of {formatCurrency(c.goalAmountCents)}
              </span>
            </p>
            <span className="eyebrow text-ember-500">{pct}%</span>
          </div>
          <div
            className="mt-2 h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-cream-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full bg-ember-500 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      <section className="container pb-12">
        {pets.length === 0 ? (
          <EmptyState
            title="No pets approved yet."
            description="Be the first! Enter your pet and get the leaderboard started."
            action={{
              href: "/enter",
              label: "Enter your pet",
              icon: <ArrowRight className="h-4 w-4" />,
            }}
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pets.map((pet) => (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  userEmail={userEmail}
                  creditBalanceCents={creditBalanceCents}
                  votingOpen={votingIsOpen}
                />
              ))}
            </div>
            <div className="mt-12">
              <Leaderboard pets={pets} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
