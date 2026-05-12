"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateContestSettings,
  type ActionResult,
} from "@/app/admin/actions";
import { Loader2 } from "lucide-react";

type Props = {
  initial: {
    submissionsOpen: boolean;
    votingOpen: boolean;
    submissionDeadline: string;
    votingDeadline: string;
    goalAmountCents: number;
  };
};

// HTML datetime-local input wants "YYYY-MM-DDTHH:mm" (no seconds, no TZ).
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function SettingsForm({ initial }: Props) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);

  return (
    <form
      className="ink-card p-6 grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setResult(await updateContestSettings(fd)));
      }}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex items-start gap-3 rounded-xl border-2 border-ink bg-cream-100 p-4">
          <input
            type="checkbox"
            name="submissionsOpen"
            defaultChecked={initial.submissionsOpen}
            className="mt-1 h-5 w-5 rounded border-2 border-ink"
          />
          <div>
            <p className="font-display text-lg font-black">Submissions open</p>
            <p className="text-sm text-ink-muted">
              Allows new pet entries. Owners are routed to Pledge.to for the $10 entry donation.
            </p>
          </div>
        </label>
        <label className="flex items-start gap-3 rounded-xl border-2 border-ink bg-cream-100 p-4">
          <input
            type="checkbox"
            name="votingOpen"
            defaultChecked={initial.votingOpen}
            className="mt-1 h-5 w-5 rounded border-2 border-ink"
          />
          <div>
            <p className="font-display text-lg font-black">Voting open</p>
            <p className="text-sm text-ink-muted">
              Shows the donate-to-vote buttons on /vote. Closing voting hides the CTAs but the
              leaderboard remains visible.
            </p>
          </div>
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="submissionDeadline">Submission deadline</Label>
          <Input
            id="submissionDeadline"
            name="submissionDeadline"
            type="datetime-local"
            required
            defaultValue={toLocalInputValue(initial.submissionDeadline)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="votingDeadline">Voting deadline</Label>
          <Input
            id="votingDeadline"
            name="votingDeadline"
            type="datetime-local"
            required
            defaultValue={toLocalInputValue(initial.votingDeadline)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goalAmountDollars">Goal amount (USD)</Label>
        <Input
          id="goalAmountDollars"
          name="goalAmountDollars"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={(initial.goalAmountCents / 100).toString()}
        />
        <p className="text-xs text-ink-muted">
          Used on the homepage and /vote progress bar. Raised total is computed live from the
          sum of approved pets&apos; donations.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ember" size="md" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </Button>
        {result && !result.ok && (
          <p role="alert" className="text-sm text-ember-700">
            {result.error}
          </p>
        )}
        {result && result.ok && (
          <p className="text-sm font-semibold">{result.message ?? "Saved."}</p>
        )}
      </div>
    </form>
  );
}
