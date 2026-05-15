import Link from "next/link";
import { Hero } from "@/components/Hero";
import { Leaderboard } from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaveDivider } from "@/components/WaveDivider";
import { getApprovedPets, getPublicContest } from "@/lib/public-data";
import { ArrowRight, Coins, Camera, HeartHandshake } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [contest, pets] = await Promise.all([
    getPublicContest(),
    getApprovedPets(),
  ]);

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

  return (
    <>
      <Hero
        contestOpen={votingIsOpen}
        votingDeadline={c.votingDeadline}
        goalAmountCents={c.goalAmountCents}
        raisedAmountCents={c.raisedAmountCents}
      />
      <WaveDivider direction="down" className="text-cream" />

      {!contest && (
        <section className="container pt-8">
          <p className="rounded-xl border-2 border-ember-500 bg-ember-50 px-4 py-3 text-sm text-ember-700">
            Live contest totals are temporarily unavailable.
          </p>
        </section>
      )}

      <section className="container py-20 md:py-24 max-w-4xl">
        <div className="text-center">
          <p className="eyebrow text-royal-700">How it works</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl font-black tracking-tight">
            Three steps. <span className="italic text-ember-500">Real dogs.</span>
          </h2>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Camera,
              title: "Enter your pet ($10)",
              body: "Submit a photo and pay the $10 entry donation through Pledge.to. Your pet goes into the review queue.",
            },
            {
              icon: Coins,
              title: "Public voting",
              body: "Once approved, anyone can vote for your pet by donating on Pledge.to. $1 = 1 vote.",
            },
            {
              icon: HeartHandshake,
              title: "Soul Dog Rescue wins",
              body: "Every dollar — entry donations and votes alike — goes to Soul Dog Rescue.",
            },
          ].map((step, i) => (
            <li
              key={step.title}
              className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-white p-6 shadow-card-sm"
            >
              <span className="stamp h-12 w-12 shrink-0 text-sm">{i + 1}</span>
              <p className="font-display text-lg font-black">{step.title}</p>
              <p className="text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild variant="ember" size="lg">
            <Link href="/enter">
              Enter your pet <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/vote">See the gallery</Link>
          </Button>
        </div>
      </section>

      <WaveDivider direction="up" className="text-ink" />
      <section className="bg-ink text-cream">
        <div className="container py-20 md:py-24 grid gap-10">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <p className="eyebrow text-ember-300">Current standings</p>
              <h2 className="mt-2 font-display text-4xl md:text-5xl font-black tracking-tight">
                Top dogs.
              </h2>
            </div>
            <Button asChild variant="ember" size="lg">
              <Link href="/vote">Donate to vote</Link>
            </Button>
          </div>
          <Leaderboard pets={pets.slice(0, 5)} />
        </div>
      </section>
      <WaveDivider direction="down" className="text-ink" />

      <section className="container py-20 md:py-24">
        <Card>
          <CardContent className="p-8 grid md:grid-cols-[1fr_auto] items-center gap-6">
            <div>
              <p className="eyebrow text-royal-700">100% pass-through</p>
              <p className="mt-2 font-display text-3xl font-black tracking-tight">
                Every donation goes to Soul Dog Rescue via Pledge.to.
              </p>
              <p className="mt-2 text-ink-muted">
                Tips and processing fees on Pledge.to don&apos;t count toward votes — only your
                donation amount does.
              </p>
            </div>
            <Button asChild variant="ember" size="lg">
              <Link href="/about">About the cause</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
