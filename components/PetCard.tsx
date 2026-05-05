"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Heart, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { VoteModal } from "./VoteModal";
import { formatNumber } from "@/lib/utils";
import type { PublicPet } from "@/lib/public-data";
import { allocateVotes } from "@/app/(site)/account/actions";

type Props = {
  pet: PublicPet;
  rank?: number;
  votingOpen: boolean;
  userRemainingCredits?: number;
};

export function PetCard({ pet, rank, votingOpen, userRemainingCredits = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(1);
  const [localRemaining, setLocalRemaining] = useState(userRemainingCredits);
  const [localVotes, setLocalVotes] = useState(pet.totalVotes);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const hasCredits = localRemaining > 0;
  const canSubmit =
    votingOpen && hasCredits && amount > 0 && amount <= localRemaining && !pending;

  function step(delta: number) {
    setAmount((a) =>
      Math.max(1, Math.min(localRemaining || 1, a + delta)),
    );
  }

  function castVote(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canSubmit) return;
    setMsg(null);
    setErr(null);
    const votes = Math.floor(amount);
    startTransition(async () => {
      const r = await allocateVotes([{ petId: pet.id, votes }]);
      if (r.ok) {
        setMsg(`+${votes} cast!`);
        setLocalRemaining((n) => n - votes);
        setLocalVotes((v) => v + votes);
        setAmount(1);
      } else {
        setErr(r.error);
      }
    });
  }

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
              {formatNumber(localVotes)}
            </Badge>
          </span>
        </button>

        <div className="p-5 flex flex-col gap-3 flex-1">
          <div>
            <h3 className="font-display text-2xl font-black leading-tight">{pet.petName}</h3>
            <p className="text-sm text-ink-muted">with {pet.ownerName}</p>
          </div>
          {pet.blurb && <p className="text-sm text-ink/80 line-clamp-2">{pet.blurb}</p>}

          <div className="mt-auto pt-2 grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">
                {formatNumber(localVotes)}{" "}
                <span className="text-ink-muted font-normal">votes</span>
              </span>
              {votingOpen && hasCredits && (
                <span className="text-xs text-ink-muted">
                  {localRemaining} left to spend
                </span>
              )}
            </div>

            {votingOpen && hasCredits ? (
              <div className="flex items-stretch gap-2">
                <div className="flex items-center rounded-full border-2 border-ink bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      step(-1);
                    }}
                    className="px-2 py-1 hover:bg-cream-100 disabled:opacity-40"
                    disabled={pending || amount <= 1}
                    aria-label="Decrease votes"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <Input
                    type="number"
                    min={1}
                    max={localRemaining}
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => {
                      const n = Math.max(
                        1,
                        Math.min(localRemaining, Math.floor(Number(e.target.value) || 1)),
                      );
                      setAmount(n);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-12 h-9 text-center border-0 rounded-none focus-visible:ring-0 bg-transparent"
                    aria-label={`Votes to cast for ${pet.petName}`}
                    disabled={pending}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      step(1);
                    }}
                    className="px-2 py-1 hover:bg-cream-100 disabled:opacity-40"
                    disabled={pending || amount >= localRemaining}
                    aria-label="Increase votes"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Button
                  variant="ember"
                  size="sm"
                  className="flex-1"
                  disabled={!canSubmit}
                  onClick={castVote}
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Voting…
                    </>
                  ) : (
                    <>
                      Vote{amount > 1 ? ` \u00d7${amount}` : ""} for {pet.petName}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant={votingOpen ? "ember" : "ghost"}
                size="sm"
                disabled={!votingOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                {!votingOpen
                  ? "Voting closed"
                  : userRemainingCredits === 0
                    ? "Donate to vote"
                    : "Out of votes"}
              </Button>
            )}

            {msg && <p className="text-xs text-royal-700">{msg}</p>}
            {err && <p className="text-xs text-ember-500">{err}</p>}
          </div>
        </div>
      </article>

      <VoteModal
        pet={pet}
        open={open}
        onOpenChange={setOpen}
        votingOpen={votingOpen}
        userRemainingCredits={localRemaining}
      />
    </>
  );
}
