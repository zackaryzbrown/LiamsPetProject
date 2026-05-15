import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { ContestStatusBadge } from "./ContestStatusBadge";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Props = {
  contestOpen: boolean;
  votingDeadline: string | null;
  goalAmountCents: number;
  raisedAmountCents: number;
  /** Override the hero photo. Defaults to an Unsplash placeholder. */
  imageSrc?: string;
  imageAlt?: string;
};

function shortDate(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Single oversized paw watermark — the brand motif behind the headline. */
function PawWatermark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <ellipse cx="50" cy="72" rx="32" ry="24" />
      <ellipse cx="16" cy="44" rx="13" ry="16" />
      <ellipse cx="84" cy="44" rx="13" ry="16" />
      <ellipse cx="33" cy="16" rx="11.5" ry="14.5" />
      <ellipse cx="67" cy="16" rx="11.5" ry="14.5" />
    </svg>
  );
}

export function Hero({
  contestOpen,
  votingDeadline,
  goalAmountCents,
  raisedAmountCents,
  imageSrc = "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80",
  imageAlt = "A happy rescue dog smiling at the camera",
}: Props) {
  const pct =
    goalAmountCents > 0
      ? Math.min(100, Math.round((raisedAmountCents / goalAmountCents) * 100))
      : 0;
  return (
    <section className="royal-panel">
      {/* Oversized translucent paw watermark — single brand stamp, no trail. */}
      <PawWatermark
        className="pointer-events-none absolute -left-24 -top-24 h-[640px] w-[640px]
                   text-royal-500/15 -rotate-[14deg] hidden md:block"
      />

      <div className="container relative grid gap-12 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-14 md:py-24">
        {/* ─── LEFT: copy ─────────────────────────────────────────── */}
        <div className="relative">
          {votingDeadline && (
            <div className="animate-rise-in" style={{ animationDelay: "60ms" }}>
              <ContestStatusBadge
                contestOpen={contestOpen}
                votingDeadline={votingDeadline}
              />
            </div>
          )}

          <h1
            className="mt-6 font-display font-black leading-[0.92] tracking-tight text-cream
                       text-5xl sm:text-6xl md:text-7xl lg:text-[88px]"
          >
            <span
              className="block animate-rise-in"
              style={{ animationDelay: "120ms" }}
            >
              Cute pets.
            </span>
            <span
              className="block animate-rise-in"
              style={{ animationDelay: "240ms" }}
            >
              Rescue <span className="italic text-ember-300">dogs</span>.
            </span>
            <span
              className="block text-cream/90 animate-rise-in"
              style={{ animationDelay: "360ms" }}
            >
              A {formatCurrency(goalAmountCents)} goal.
            </span>
          </h1>

          <p
            className="mt-6 max-w-xl text-cream/85 text-lg md:text-xl leading-relaxed animate-rise-in"
            style={{ animationDelay: "480ms" }}
          >
            Submit your pet, share their best photo, and let the public vote
            with donations to{" "}
            <span className="font-semibold text-white">Soul Dog Rescue</span>.
            It&apos;s Liam&apos;s Mile High Karate community service project.
          </p>

          <div
            className="mt-8 flex flex-wrap gap-3 animate-rise-in"
            style={{ animationDelay: "600ms" }}
          >
            <Button asChild variant="ember" size="lg">
              <Link href="/vote">
                Donate now <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="bg-white/95">
              <Link href="/enter">Enter your pet</Link>
            </Button>
          </div>

          {/* Slim progress bar — social proof + urgency right under the CTAs.
              Cream-on-royal variant of the GoalProgress card. */}
          <div
            className="mt-8 max-w-xl animate-rise-in"
            style={{ animationDelay: "660ms" }}
            role="group"
            aria-label="Fundraiser progress"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-display text-cream">
                <span className="text-2xl md:text-3xl font-black">
                  {formatCurrency(raisedAmountCents)}
                </span>
                <span className="ml-2 text-cream/60 text-base md:text-lg font-semibold">
                  raised of {formatCurrency(goalAmountCents)}
                </span>
              </p>
              <span className="eyebrow text-ember-300">{pct}%</span>
            </div>
            <div
              className="mt-2 h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-royal-950/40"
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

          {/* Compact inline stats — pills, not heavy cards, so they sit
              quietly under the CTAs instead of competing with the photo. */}
          <dl
            className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-cream animate-rise-in"
            style={{ animationDelay: "780ms" }}
          >
            {[
              { k: "Per pet", v: "$10" },
              { k: "1 vote", v: "$1" },
              { k: "Closes", v: shortDate(votingDeadline) },
            ].map((s, i, arr) => (
              <div key={s.k} className="flex items-baseline gap-2">
                <dt className="eyebrow text-ember-300">{s.k}</dt>
                <dd className="font-display text-xl font-black">{s.v}</dd>
                {i < arr.length - 1 && (
                  <span aria-hidden className="ml-4 text-cream/30">
                    /
                  </span>
                )}
              </div>
            ))}
          </dl>
        </div>

        {/* ─── RIGHT: tilted polaroid photo ───────────────────────── */}
        <div
          className="relative mx-auto w-full max-w-sm md:max-w-md animate-rise-in"
          style={{ animationDelay: "200ms" }}
        >
          {/* Slight idle rotation on hover groups the whole composition. */}
          <div className="relative -rotate-3 transition-transform duration-500 hover:rotate-0">
            {/* The polaroid: chunky ink border, cream "film" frame, chunky shadow. */}
            <div className="rounded-[18px] border-2 border-ink bg-cream p-3 pb-5 shadow-card">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] border-2 border-ink bg-ink/5">
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  fill
                  priority
                  sizes="(min-width: 768px) 440px, 80vw"
                  className="object-cover"
                />
              </div>
              {/* Handwritten-feel caption — italic display font channels marker pen. */}
              <p className="mt-3 px-2 font-display italic text-ink text-lg leading-tight">
                For Soul Dog Rescue
                <span className="ml-2 text-ink-muted not-italic text-sm">
                  &mdash; vote with $1
                </span>
              </p>
            </div>

            {/* Wax-seal stamp pinned to the corner. ONE focal accent. */}
            <div
              className="absolute -bottom-6 -left-6 rotate-[-10deg] animate-tilt"
              style={{ animationDelay: "900ms" }}
            >
              <div className="stamp h-24 w-24 flex-col text-center leading-tight">
                <span className="text-[10px] uppercase tracking-[0.2em] not-italic font-semibold">
                  Every
                </span>
                <span className="font-display text-3xl">$1</span>
                <span className="text-[10px] uppercase tracking-[0.2em] not-italic font-semibold">
                  = 1 vote
                </span>
              </div>
            </div>

            {/* Tiny tape strip at the top — playful editorial detail. */}
            <div
              aria-hidden
              className="absolute -top-3 left-10 h-6 w-20 rotate-[-6deg] bg-ember-300/80
                         border border-ink/20 shadow-[0_2px_0_rgba(10,10,10,0.4)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
