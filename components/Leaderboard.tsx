import Image from "next/image";
import { formatNumber } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import type { PublicPet } from "@/lib/public-data";

export function Leaderboard({ pets }: { pets: PublicPet[] }) {
  const sorted = [...pets].sort((a, b) => b.totalVotes - a.totalVotes);
  if (sorted.length === 0) {
    return (
      <EmptyState
        variant="ink"
        title="No votes yet."
        description="Donate to a pet to put them on the board."
      />
    );
  }
  return (
    <div className="ink-card overflow-hidden">
      <div className="p-5 border-b-2 border-ink bg-ink text-cream flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-black">The Leaderboard</h2>
        <p className="text-xs uppercase tracking-widest text-cream/70">Live ranking</p>
      </div>
      <ol className="divide-y-2 divide-ink">
        {sorted.map((pet, i) => (
          <li key={pet.id} className="flex items-center gap-4 p-4 sm:p-5">
            <span
              aria-label={`Rank ${i + 1}`}
              className={
                "stamp h-12 w-12 text-base shrink-0 " +
                (i === 0
                  ? "bg-ember-500"
                  : i === 1
                  ? "bg-royal-600"
                  : i === 2
                  ? "bg-ink"
                  : "bg-cream-200 !text-ink")
              }
            >
              <span aria-hidden>#{i + 1}</span>
            </span>
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl border-2 border-ink overflow-hidden bg-cream-200 shrink-0">
              <Image
                src={pet.imageUrl}
                alt={pet.petName}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg sm:text-xl font-black truncate">{pet.petName}</p>
              <p className="text-xs sm:text-sm text-ink-muted truncate">with {pet.ownerName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-2xl font-black tabular-nums">
                {formatNumber(pet.totalVotes)}
              </p>
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-ink-muted">votes</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
