import Link from "next/link";
import { Button } from "./ui/button";
import { ContestStatusBadge } from "./ContestStatusBadge";
import { PawMark } from "./PawMark";
import { ArrowRight } from "lucide-react";

type Props = {
  contestOpen: boolean;
  votingDeadline: string | null;
};

export function Hero({ contestOpen, votingDeadline }: Props) {
  return (
    <section className="royal-panel">
      {/* decorative paws */}
      <PawMark
        size={120}
        className="absolute -left-6 top-12 text-royal-500/25 -rotate-12 hidden md:block"
      />
      <PawMark
        size={84}
        className="absolute right-10 bottom-10 text-ember-300/40 rotate-12 hidden md:block"
      />
      <div className="container relative py-16 md:py-24">
        {votingDeadline && (
          <ContestStatusBadge contestOpen={contestOpen} votingDeadline={votingDeadline} />
        )}
        <h1 className="mt-6 font-display font-black leading-[0.95] tracking-tight text-cream
                       text-5xl sm:text-6xl md:text-7xl lg:text-[88px]">
          Cute pets.
          <span className="block">
            Rescue <span className="italic text-ember-300">dogs</span>.
          </span>
          <span className="block text-cream/90">A $500 goal.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-cream/85 text-lg md:text-xl leading-relaxed">
          Submit your pet, share their best photo, and let the public vote with donations to{" "}
          <span className="font-semibold text-white">Soul Dog Rescue</span>. It&apos;s Liam&apos;s
          Mile High Karate community service project.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="ember" size="lg">
            <Link href="/enter">
              Enter your pet <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="bg-white/95">
            <Link href="/vote">View &amp; vote</Link>
          </Button>
        </div>

        <dl className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          {[
            { k: "Goal", v: "$500" },
            { k: "Min entry", v: "$10" },
            { k: "1 vote", v: "$1" },
            { k: "Closes", v: "Nov 13" },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-2xl border-2 border-ink bg-cream text-ink p-4 shadow-card-sm"
            >
              <dt className="eyebrow text-royal-700">{s.k}</dt>
              <dd className="font-display text-2xl font-black mt-1">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
