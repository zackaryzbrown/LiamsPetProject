import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PetCard } from "@/components/PetCard";
import { GoalProgress } from "@/components/GoalProgress";
import { Leaderboard } from "@/components/Leaderboard";
import { ContestStatusBadge } from "@/components/ContestStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { getApprovedPets, getPublicContest } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CONTEST } from "@/lib/mock-data";
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

  const c = contest ?? {
    contestOpen: MOCK_CONTEST.contestOpen,
    submissionsOpen: MOCK_CONTEST.contestOpen,
    votingOpen: MOCK_CONTEST.contestOpen,
    votingDeadline: MOCK_CONTEST.votingDeadline,
    submissionDeadline: MOCK_CONTEST.submissionDeadline,
    goalAmountCents: MOCK_CONTEST.goalAmountCents,
    raisedAmountCents: MOCK_CONTEST.raisedAmountCents,
  };

  return (
    <>
      <section className="container py-12 md:py-16 grid gap-8 lg:grid-cols-[1fr_360px] items-start">
        <header>
          <p className="eyebrow text-royal-700">Vote with a donation</p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
            Pick a pet. <span className="italic text-ember-500">Donate.</span> Vote.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-muted">
            Every dollar you donate to a pet on Pledge.to counts as one vote. 100% of donations
            support <strong>Soul Dog Rescue</strong>.
          </p>
          <ContestStatusBadge
            contestOpen={c.votingOpen}
            votingDeadline={c.votingDeadline}
            className="mt-5"
          />
        </header>
        <GoalProgress raisedCents={c.raisedAmountCents} goalCents={c.goalAmountCents} />
      </section>

      <section className="container pb-12">
        {pets.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center grid gap-4">
              <p className="font-display text-3xl font-black">No pets approved yet.</p>
              <p className="text-ink-muted">
                Be the first! Enter your pet and get the leaderboard started.
              </p>
              <div className="flex justify-center">
                <Button asChild variant="ember" size="lg">
                  <Link href="/enter">
                    Enter your pet <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} userEmail={userEmail} />
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
