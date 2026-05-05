import Link from "next/link";
import { Hero } from "@/components/Hero";
import { GoalProgress } from "@/components/GoalProgress";
import { WaveDivider } from "@/components/WaveDivider";
import { Button } from "@/components/ui/button";
import { PawMark } from "@/components/PawMark";
import { getPublicContest } from "@/lib/public-data";
import { ArrowRight, Camera, HandCoins, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const contest = await getPublicContest();
  return (
    <>
      <Hero
        contestOpen={contest.contestOpen}
        votingDeadline={contest.votingDeadline}
      />
      <WaveDivider direction="up" className="text-royal-700 -mt-px" />

      {/* Goal */}
      <section className="container -mt-6 md:-mt-12 relative z-10">
        <GoalProgress
          raisedCents={contest.raisedAmountCents}
          goalCents={contest.goalAmountCents}
        />
      </section>

      {/* 3-step flow */}
      <section className="container py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="eyebrow text-royal-700">How it works</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl font-black tracking-tight">
            Three steps. <span className="italic text-ember-500">Real</span> tails wagging.
          </h2>
          <p className="mt-4 text-ink-muted text-lg">
            Submitting a pet takes a couple of minutes. Voting takes about ten seconds, plus
            whatever you can spare.
          </p>
        </div>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Camera,
              n: "01",
              title: "Submit your pet's photo",
              body: "Sign in with Google, upload one good shot, and tell us their name.",
            },
            {
              icon: HandCoins,
              n: "02",
              title: "Make the $10 entry donation",
              body: "Powered by Givebutter. It also counts as your pet's first 10 votes.",
            },
            {
              icon: Trophy,
              n: "03",
              title: "Get approved → start collecting votes",
              body: "After admin approval your pet appears publicly. Friends donate to vote.",
            },
          ].map(({ icon: Icon, n, title, body }) => (
            <li key={n} className="ink-card p-6 relative">
              <span className="stamp absolute -top-4 -left-3 h-12 w-12 rotate-[-6deg] text-sm">
                {n}
              </span>
              <Icon className="h-7 w-7 text-royal-700" />
              <h3 className="mt-4 font-display text-xl font-black">{title}</h3>
              <p className="mt-2 text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="ember" size="lg">
            <Link href="/enter">
              Enter your pet <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/vote">Browse all pets</Link>
          </Button>
        </div>
      </section>

      <WaveDivider direction="down" className="text-ink" />

      {/* Mission strip */}
      <section className="bg-ink text-cream">
        <div className="container py-20 md:py-24 grid md:grid-cols-2 gap-10 items-start">
          <div>
            <p className="eyebrow text-ember-300">The mission</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl font-black leading-[1.05]">
              We&apos;re raising <span className="italic text-ember-300">$500</span> for{" "}
              <span className="text-white">Soul Dog Rescue</span>.
            </h2>
            <p className="mt-5 text-cream/80 text-lg leading-relaxed">
              Soul Dog Rescue places dogs from overcrowded shelters into loving homes. This
              fundraiser is part of Liam&apos;s community service project at Mile High Karate.
              Black belts, big hearts, bigger paws.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="ember" size="lg">
                <Link href="/about">Read the story</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="bg-cream/95">
                <Link href="/rules">Rules &amp; FAQ</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { k: "1st place", v: "$100 Chewy Card + Custom Pet Portrait" },
              { k: "2nd place", v: "Custom Pet Pillow" },
              { k: "Submissions close", v: "Nov 13, 11:59 PM" },
              { k: "Voting closes", v: "Nov 13, 11:59 PM" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border-2 border-cream/20 bg-royal-800/40 p-5 backdrop-blur"
              >
                <p className="eyebrow text-ember-300">{s.k}</p>
                <p className="mt-2 font-display text-xl font-black">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="container pb-12 flex items-center gap-3 text-cream/70">
          <PawMark size={18} className="text-ember-300" />
          <span className="text-sm">Donations processed by Givebutter. Not refundable.</span>
        </div>
      </section>
    </>
  );
}
