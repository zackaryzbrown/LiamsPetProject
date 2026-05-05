"use client";

import Image from "next/image";
import { Heart, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { formatNumber } from "@/lib/utils";
import type { PublicPet } from "@/lib/public-data";

type Props = {
  pet: PublicPet;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  votingOpen: boolean;
};

export function VoteModal({ pet, open, onOpenChange, votingOpen }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden">
        <div className="relative aspect-[5/4] w-full border-b-2 border-ink bg-cream-200">
          <Image
            src={pet.imageUrl}
            alt={pet.petName}
            fill
            sizes="(min-width: 768px) 640px, 92vw"
            className="object-cover"
            priority
          />
          <span className="absolute bottom-3 left-3">
            <Badge tone="ember">
              <Heart className="h-3.5 w-3.5 fill-current" />
              {formatNumber(pet.totalVotes)} votes
            </Badge>
          </span>
        </div>
        <div className="p-6 sm:p-7">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <DialogTitle>
                {pet.petName}
                <span className="text-ink-muted/80 font-display italic font-medium text-lg">
                  {" "}with {pet.ownerName}
                </span>
              </DialogTitle>
              {pet.blurb && (
                <DialogDescription className="mt-2">{pet.blurb}</DialogDescription>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink bg-cream-100 p-4">
            <div>
              <p className="eyebrow text-royal-700">Current votes</p>
              <p className="font-display text-3xl font-black">{formatNumber(pet.totalVotes)}</p>
            </div>
            {votingOpen && pet.givebutterMemberUrl ? (
              <Button asChild variant="ember" size="lg">
                <a href={pet.givebutterMemberUrl} target="_blank" rel="noreferrer">
                  Donate to vote <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : votingOpen ? (
              <Button variant="ember" size="lg" disabled aria-disabled="true">
                Donation link coming soon
              </Button>
            ) : (
              <Button variant="ghost" size="lg" disabled aria-disabled="true">
                Voting closed
              </Button>
            )}
          </div>

          <p className="mt-4 text-xs text-ink-muted">
            Donations are processed by Givebutter. <strong>$1 = 1 vote</strong>. Donations support
            Soul Dog Rescue and are <strong>not refundable</strong>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
