import Link from "next/link";
import { PetCard } from "@/components/PetCard";
import { Leaderboard } from "@/components/Leaderboard";
import { ContestStatusBadge } from "@/components/ContestStatusBadge";
import { Button } from "@/components/ui/button";
import { getApprovedPets, getPublicContest } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "View & Vote" };

export default async function VotePage() {
  const [pets, contest] = await Promise.all([getApprovedPets(), getPublicContest()]);
  const votingDeadlineMs = contest.votingDeadline
    ? new Date(contest.votingDeadline).getTime()
    : Number.POSITIVE_INFINITY;
  const votingOpen = contest.contestOpen && Date.now() < votingDeadlineMs;

  return (
    <>
      <section className="border-b-2 border-ink bg-cream">
        <div className="container py-12 md:py-16">
          <p className="eyebrow text-royal-700">Approved entries</p>
          <div className="mt-2 flex items-end justify-between flex-wrap gap-4">
            <h1 className="font-display text-5xl md:text-6xl font-black tracking-tight max-w-3xl">
              Pick a face. <span className="italic text-ember-500">Donate.</span> That&apos;s a vote.
            </h1>
            {contest.votingDeadline && (
              <ContestStatusBadge
                contestOpen={contest.contestOpen}
                votingDeadline={contest.votingDeadline}
              />
            )}
          </div>
          <p className="mt-4 text-ink-muted text-lg max-w-2xl">
            Every $1 you donate counts as one vote for the pet you choose. Donations go directly
            to Soul Dog Rescue via Givebutter.
          </p>
        </div>
      </section>

      <section className="container py-12 md:py-16">
        {pets.length === 0 ? (
          <div className="ink-card p-10 text-center">
            <p className="eyebrow text-royal-700">No approved pets yet</p>
            <h2 className="mt-2 font-display text-3xl font-black">Be the first one in.</h2>
            <p className="mt-2 text-ink-muted max-w-md mx-auto">
              The contest is fresh — entries appear here once an admin approves them. Submit your
              pet to get the leaderboard rolling.
            </p>
            <div className="mt-5 flex justify-center">
              <Button asChild variant="ember" size="lg">
                <Link href="/enter">Enter your pet</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pets.map((pet, i) => (
                <PetCard key={pet.id} pet={pet} rank={i} votingOpen={votingOpen} />
              ))}
            </div>

            <div className="mt-16">
              <Leaderboard pets={pets} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
