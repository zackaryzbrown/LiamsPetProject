"use client";

import Image from "next/image";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { PublicPet } from "@/lib/public-data";
import { recordVoteIntent } from "@/app/(site)/vote/actions";
import { spendVoteCreditsAction } from "@/app/(site)/account/actions";
import { ArrowUpRight, Heart, Loader2, ShieldCheck, Wallet } from "lucide-react";

type Props = {
  pet: PublicPet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Email of the currently signed-in user, if any. Skip the prompt
  // entirely when we already have an email we can attribute against.
  userEmail?: string | null;
  // Signed-in user's spendable wallet, in cents. Non-zero unlocks the
  // "Spend credits" mode that calls `spendVoteCreditsAction` directly
  // instead of opening Pledge.to.
  creditBalanceCents?: number;
};

// =====================================================================
// Donate-to-vote modal.
//
// Two ways to add votes:
//
//   - Spend credits: signed-in users who have a positive
//     vote_credit_ledger balance (typically from a previous entry
//     donation that exceeded the $10 entry fee) can apply them
//     directly to this pet without going through Pledge.to.
//   - Donate: open Pledge.to in a new tab. We collect an email up
//     front so the webhook can attribute the donation back to this pet
//     via donor email (Pledge's hosted page drops URL params, so
//     submission_id / utm_content are not reliably forwarded). The
//     recorded intent row expires after 60 minutes.
// =====================================================================
export function VoteModal({
  pet,
  open,
  onOpenChange,
  userEmail,
  creditBalanceCents = 0,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = React.useState(userEmail ?? "");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const maxCreditVotes = Math.floor(creditBalanceCents / 100);
  const canSpendCredits = maxCreditVotes > 0;
  const [mode, setMode] = React.useState<"credits" | "donate">(
    canSpendCredits ? "credits" : "donate",
  );
  const [creditVotes, setCreditVotes] = React.useState<string>(
    canSpendCredits ? String(Math.min(5, maxCreditVotes)) : "1",
  );

  // Reset transient state whenever the modal opens for a fresh pet.
  React.useEffect(() => {
    if (!open) {
      setError(null);
    } else {
      setEmail(userEmail ?? "");
      setMode(canSpendCredits ? "credits" : "donate");
      setCreditVotes(canSpendCredits ? String(Math.min(5, maxCreditVotes)) : "1");
    }
  }, [open, userEmail, canSpendCredits, maxCreditVotes]);

  const donationUrl = pet.pledgeDonationUrl;

  function handleDonate() {
    if (!donationUrl) return;
    const trimmed = email.trim();
    if (trimmed.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter the email you'll use on Pledge.to.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordVoteIntent({
        petSubmissionId: pet.id,
        donorEmail: trimmed,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Open Pledge in a new tab — the intent row will live in our DB
      // for 60 minutes while the donor completes the donation.
      window.open(donationUrl, "_blank", "noopener,noreferrer");
      onOpenChange(false);
    });
  }

  function handleSpendCredits() {
    const votes = Number.parseInt(creditVotes, 10);
    if (!Number.isFinite(votes) || votes < 1) {
      setError("Enter how many votes (whole dollars) to spend.");
      return;
    }
    if (votes > maxCreditVotes) {
      setError(
        `You only have ${maxCreditVotes} vote${maxCreditVotes === 1 ? "" : "s"} available.`,
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("petSubmissionId", pet.id);
      fd.set("votes", String(votes));
      const result = await spendVoteCreditsAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

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
              <DialogTitle>Vote for {pet.petName}</DialogTitle>
              <DialogDescription className="mt-1">
                Every dollar counts as one vote. All donations go directly
                to Soul Dog Rescue via Pledge.to.
              </DialogDescription>
            </header>

            <div className="inline-flex items-center gap-2 self-start rounded-full border-2 border-ink bg-cream-100 px-3 py-1 text-xs font-semibold">
              <Heart className="h-3.5 w-3.5 text-ember-500" />
              Currently {formatNumber(pet.totalVotes)} votes
            </div>

            {canSpendCredits && (
              <div
                role="tablist"
                aria-label="Choose how to vote"
                className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-ink bg-cream-100 p-1 text-sm font-semibold"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "credits"}
                  onClick={() => setMode("credits")}
                  className={`rounded-xl px-3 py-2 transition ${
                    mode === "credits"
                      ? "bg-ink text-cream"
                      : "text-ink hover:bg-cream-200"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Use credits
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "donate"}
                  onClick={() => setMode("donate")}
                  className={`rounded-xl px-3 py-2 transition ${
                    mode === "donate"
                      ? "bg-ink text-cream"
                      : "text-ink hover:bg-cream-200"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Donate more
                  </span>
                </button>
              </div>
            )}

            {mode === "credits" && canSpendCredits ? (
              <>
                <div className="rounded-xl border-2 border-ink bg-cream-50 px-3 py-2 text-sm">
                  <p className="font-semibold">
                    Wallet balance: {formatCurrency(creditBalanceCents)} ·{" "}
                    {formatNumber(maxCreditVotes)} vote
                    {maxCreditVotes === 1 ? "" : "s"} available
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Credits come from entry donations over $10. They go
                    straight to this pet&apos;s vote total — no extra
                    donation needed.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="creditVotes">
                    Votes to spend on {pet.petName}
                  </Label>
                  <Input
                    id="creditVotes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxCreditVotes}
                    step={1}
                    value={creditVotes}
                    onChange={(e) => setCreditVotes(e.target.value)}
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
                <Button
                  type="button"
                  variant="ember"
                  size="lg"
                  onClick={handleSpendCredits}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className="h-4 w-4" />
                  )}
                  {pending ? "Casting votes…" : "Cast votes from wallet"}
                </Button>
              </>
            ) : donationUrl ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="voterEmail">
                    Email you&apos;ll use on Pledge.to
                  </Label>
                  <Input
                    id="voterEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={pending}
                  />
                  <p className="text-xs text-ink-muted">
                    We use this to match your donation back to {pet.petName}.
                    Use the same email when checking out on Pledge.to.
                  </p>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border-2 border-ember-500 bg-ember-50 px-3 py-2 text-sm text-ember-700"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="button"
                  variant="ember"
                  size="lg"
                  onClick={handleDonate}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                  {pending ? "Opening Pledge…" : "Donate on Pledge.to"}
                </Button>
              </>
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
