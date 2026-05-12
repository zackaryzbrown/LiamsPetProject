"use client";

import Image from "next/image";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { VoteModal } from "@/components/VoteModal";
import { formatNumber } from "@/lib/utils";
import type { PublicPet } from "@/lib/public-data";
import { Heart } from "lucide-react";

// =====================================================================
// One pet on the /vote grid. Tapping "Donate to vote" opens the
// VoteModal which links straight to Pledge.to. There is no credit
// wallet; every dollar donated through Pledge.to counts as one vote
// once the webhook receives the confirmation.
// =====================================================================
export function PetCard({
  pet,
  userEmail,
}: {
  pet: PublicPet;
  userEmail?: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <div className="ink-card overflow-hidden flex flex-col">
        <div className="relative aspect-[4/3] bg-cream-200">
          <Image
            src={pet.imageUrl}
            alt={pet.petName}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-cream/95 px-3 py-1 text-xs font-semibold">
            <Heart className="h-3.5 w-3.5 text-ember-500" />
            {formatNumber(pet.totalVotes)} votes
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col gap-3">
          <div>
            <p className="font-display text-2xl font-black tracking-tight">{pet.petName}</p>
            <p className="text-sm text-ink-muted">with {pet.ownerName}</p>
          </div>
          <div className="mt-auto">
            <Button
              type="button"
              variant="ember"
              size="md"
              className="w-full"
              disabled={!pet.pledgeDonationUrl}
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
            >
              {pet.pledgeDonationUrl ? "Donate to vote" : "Donation link coming soon"}
            </Button>
          </div>
        </div>
      </div>
      <VoteModal
        pet={pet}
        open={open}
        onOpenChange={setOpen}
        userEmail={userEmail}
      />
    </>
  );
}
