"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { Heart, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatNumber } from "@/lib/utils";
import type { PublicPet } from "@/lib/public-data";
import { allocateVotes } from "@/app/(site)/account/actions";

type Props = {
  pet: PublicPet;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  votingOpen: boolean;
  userRemainingCredits?: number;
};

export function VoteModal({
  pet,
  open,
  onOpenChange,
  votingOpen,
  userRemainingCredits = 0,
}: Props) {
  const hasCredits = userRemainingCredits > 0;
  const [amount, setAmount] = useState<number>(1);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [localRemaining, setLocalRemaining] = useState(userRemainingCredits);

  // Reset state whenever the modal is opened for a new pet.
  useEffect(() => {
    if (open) {
      setAmount(Math.min(1, userRemainingCredits) || 1);
      setMsg(null);
      setErr(null);
      setLocalRemaining(userRemainingCredits);
    }
  }, [open, userRemainingCredits]);

  function submit() {
    setMsg(null);
    setErr(null);
    const votes = Math.max(0, Math.floor(amount));
    if (votes <= 0) {
      setErr("Enter a number of votes greater than 0.");
      return;
    }
    if (votes > localRemaining) {
      setErr(`You only have ${localRemaining} votes left.`);
      return;
    }
    startTransition(async () => {
      const r = await allocateVotes([{ petId: pet.id, votes }]);
      if (r.ok) {
        setMsg(`Cast ${votes} vote${votes === 1 ? "" : "s"} for ${pet.petName}.`);
        setLocalRemaining((n) => n - votes);
        setAmount(0);
      } else {
        setErr(r.error);
      }
    });
  }

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

          <div className="mt-5 rounded-xl border-2 border-ink bg-cream-100 p-4 grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow text-royal-700">Current votes</p>
                <p className="font-display text-3xl font-black">
                  {formatNumber(pet.totalVotes)}
                </p>
              </div>
              {votingOpen && hasCredits && (
                <p className="text-sm text-ink-muted">
                  You have{" "}
                  <strong className="text-ink">{localRemaining}</strong> spendable
                  {" "}vote{localRemaining === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {votingOpen && hasCredits ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, localRemaining)}
                  inputMode="numeric"
                  value={amount === 0 ? "" : amount}
                  onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
                  className="w-24 text-center"
                  aria-label={`Votes to cast for ${pet.petName}`}
                  disabled={pending || localRemaining === 0}
                />
                <Button
                  variant="ember"
                  size="lg"
                  onClick={submit}
                  disabled={pending || amount <= 0 || amount > localRemaining}
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Casting…
                    </>
                  ) : (
                    <>Vote for {pet.petName}</>
                  )}
                </Button>
              </div>
            ) : votingOpen && pet.givebutterMemberUrl ? (
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

            {msg && <p className="text-sm text-royal-700">{msg}</p>}
            {err && <p className="text-sm text-ember-500">{err}</p>}
          </div>

          <p className="mt-4 text-xs text-ink-muted">
            {hasCredits ? (
              <>
                Votes draw from your existing donation credit. <strong>$1 = 1 vote</strong>.
                Allocations are final.
              </>
            ) : (
              <>
                Donations are processed by Givebutter. <strong>$1 = 1 vote</strong>. Donations
                support Soul Dog Rescue and are <strong>not refundable</strong>.
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
