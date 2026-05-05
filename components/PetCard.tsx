"use client";

import Image from "next/image";
import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { VoteModal } from "./VoteModal";
import { formatNumber } from "@/lib/utils";
import type { PublicPet } from "@/lib/public-data";

type Props = {
  pet: PublicPet;
  rank?: number;
  votingOpen: boolean;
};

export function PetCard({ pet, rank, votingOpen }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <article className="ink-card group flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative aspect-[4/3] w-full overflow-hidden border-b-2 border-ink bg-cream-200"
          aria-label={`Open ${pet.petName}`}
        >
          <Image
            src={pet.imageUrl}
            alt={pet.petName}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          {rank !== undefined && rank < 3 && (
            <span className="stamp absolute -top-3 -left-3 h-14 w-14 text-base rotate-[-8deg]">
              #{rank + 1}
            </span>
          )}
          <span className="absolute bottom-3 right-3">
            <Badge tone="ink">
              <Heart className="h-3.5 w-3.5 fill-current" />
              {formatNumber(pet.totalVotes)}
            </Badge>
          </span>
        </button>

        <div className="p-5 flex flex-col gap-3 flex-1">
          <div>
            <h3 className="font-display text-2xl font-black leading-tight">{pet.petName}</h3>
            <p className="text-sm text-ink-muted">with {pet.ownerName}</p>
          </div>
          {pet.blurb && <p className="text-sm text-ink/80 line-clamp-2">{pet.blurb}</p>}
          <div className="mt-auto pt-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              {formatNumber(pet.totalVotes)} <span className="text-ink-muted font-normal">votes</span>
            </span>
            <Button
              variant="ember"
              size="sm"
              disabled={!votingOpen}
              onClick={() => setOpen(true)}
            >
              {votingOpen ? `Vote for ${pet.petName}` : "Voting closed"}
            </Button>
          </div>
        </div>
      </article>

      <VoteModal pet={pet} open={open} onOpenChange={setOpen} votingOpen={votingOpen} />
    </>
  );
}
