"use client";

import Image from "next/image";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import type { PublicPet } from "@/lib/public-data";
import { ArrowUpRight, Heart, ShieldCheck } from "lucide-react";

type Props = {
  pet: PublicPet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// =====================================================================
// Donate-to-vote modal. We only render a single primary CTA — the
// Pledge.to donation link — because Pledge.to is the only donation
// platform. Donors choose their amount inside Pledge's hosted flow;
// $1 = 1 vote, applied automatically by our webhook.
// =====================================================================
export function VoteModal({ pet, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="grid sm:grid-cols-[160px_1fr] gap-0 sm:gap-5">
          <div className="relative aspect-square sm:rounded-l-2xl overflow-hidden border-b-2 sm:border-b-0 sm:border-r-2 border-ink">
            <Image
              src={pet.imageUrl}
              alt={pet.petName}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
          <div className="p-5 sm:py-6 sm:pr-6 grid gap-4">
            <header>
              <DialogTitle>Donate to vote for {pet.petName}</DialogTitle>
              <DialogDescription className="mt-1">
                Every dollar you donate counts as one vote. All donations go
                directly to Soul Dog Rescue via Pledge.to.
              </DialogDescription>
            </header>

            <div className="inline-flex items-center gap-2 self-start rounded-full border-2 border-ink bg-cream-100 px-3 py-1 text-xs font-semibold">
              <Heart className="h-3.5 w-3.5 text-ember-500" />
              Currently {formatNumber(pet.totalVotes)} votes
            </div>

            {pet.pledgeDonationUrl ? (
              <Button asChild variant="ember" size="lg">
                <a
                  href={pet.pledgeDonationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Donate on Pledge.to <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <p
                role="alert"
                className="rounded-xl border-2 border-ink bg-cream-100 px-4 py-3 text-sm text-ink-muted"
              >
                A donation link hasn&apos;t been configured for this pet yet.
                Please check back shortly.
              </p>
            )}

            <p className="flex items-start gap-2 text-xs text-ink-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-royal-700" />
              Pledge.to handles payment securely. Tips and processing fees
              don&apos;t count toward votes — only the donation amount does.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
