"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { spendVoteCreditsAction } from "../actions";
import { formatCurrency } from "@/lib/utils";
import { Heart, Loader2 } from "lucide-react";

// =====================================================================
// Account-page card for spending wallet credits on an approved pet.
// Mirrors the modal flow on /vote but lets the user pick the pet from
// a dropdown of all approved entries. Hidden when the wallet is empty.
// =====================================================================
export function SpendCreditsCard({
  balanceCents,
  pets,
  votingOpen = true,
}: {
  balanceCents: number;
  pets: { id: string; name: string }[];
  votingOpen?: boolean;
}) {
  const router = useRouter();
  const maxVotes = Math.floor(balanceCents / 100);
  const [petId, setPetId] = React.useState<string>(pets[0]?.id ?? "");
  const [votes, setVotes] = React.useState<string>(
    maxVotes > 0 ? String(Math.min(5, maxVotes)) : "1",
  );
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  if (!votingOpen || balanceCents <= 0 || pets.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 grid gap-3">
          <p className="font-display text-xl font-black tracking-tight">
            Spend credits
          </p>
          <p className="text-sm text-ink-muted">
            {!votingOpen
              ? "Voting is currently closed. Your credits are safe in your wallet and will be available when voting reopens."
              : balanceCents <= 0
              ? "You don't have any credits yet. Donate more than $10 when you enter a pet, and the overage will land here as spendable votes."
              : "No approved pets yet — check back once submissions are reviewed."}
          </p>
        </CardContent>
      </Card>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(votes, 10);
    if (!Number.isFinite(n) || n < 1) {
      setError("Enter how many votes to spend.");
      return;
    }
    if (n > maxVotes) {
      setError(`You only have ${maxVotes} vote${maxVotes === 1 ? "" : "s"} available.`);
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("petSubmissionId", petId);
      fd.set("votes", String(n));
      const result = await spendVoteCreditsAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        `Cast ${n} vote${n === 1 ? "" : "s"}. ${formatCurrency(result.remainingCents)} remaining.`,
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="grid gap-3">
          <p className="font-display text-xl font-black tracking-tight">
            Spend credits
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="petId">Pet</Label>
            <select
              id="petId"
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              disabled={pending}
              className="h-10 rounded-xl border-2 border-ink bg-cream-50 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ember-500"
            >
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="votes">Votes ({maxVotes} available)</Label>
            <Input
              id="votes"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxVotes}
              step={1}
              value={votes}
              onChange={(e) => setVotes(e.target.value)}
              disabled={pending}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border-2 border-ember-500 bg-ember-50 px-3 py-2 text-sm text-ember-700"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="rounded-xl border-2 border-royal-700 bg-royal-50 px-3 py-2 text-sm text-royal-700"
            >
              {success}
            </p>
          )}
          <Button type="submit" variant="ember" size="md" disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className="h-4 w-4" />
            )}
            {pending ? "Casting…" : "Cast votes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
