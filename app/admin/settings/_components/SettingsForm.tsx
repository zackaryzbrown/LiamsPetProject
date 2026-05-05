"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateContestSettings } from "@/app/admin/actions";
import { Loader2 } from "lucide-react";

export function SettingsForm({
  contestOpen,
  submissionDeadline,
  votingDeadline,
  goalAmountDollars,
}: {
  contestOpen: boolean;
  submissionDeadline: string;
  votingDeadline: string;
  goalAmountDollars: string;
}) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          setErr(null);
          // Checkbox sends nothing if unchecked → set explicit "false".
          if (!fd.get("contestOpen")) fd.set("contestOpen", "false");
          // datetime-local values are local; convert to ISO before sending.
          for (const key of ["submissionDeadline", "votingDeadline"] as const) {
            const v = fd.get(key) as string | null;
            if (v) fd.set(key, new Date(v).toISOString());
          }
          const r = await updateContestSettings(fd);
          if (r.ok) setMsg(r.message ?? "Saved.");
          else setErr(r.error);
        })
      }
      className="grid gap-5"
    >
      <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-ink bg-cream-100">
        <input
          type="checkbox"
          name="contestOpen"
          defaultChecked={contestOpen}
          className="mt-1 h-5 w-5 rounded border-2 border-ink"
        />
        <span>
          <span className="font-display text-lg font-black block">Contest is open</span>
          <span className="text-sm text-ink-muted block">
            When unchecked, submissions and voting are blocked sitewide regardless of deadlines.
          </span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="submissionDeadline">Submission deadline</Label>
          <Input
            id="submissionDeadline"
            name="submissionDeadline"
            type="datetime-local"
            defaultValue={submissionDeadline}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="votingDeadline">Voting deadline</Label>
          <Input
            id="votingDeadline"
            name="votingDeadline"
            type="datetime-local"
            defaultValue={votingDeadline}
            required
          />
        </div>
      </div>

      <div className="grid gap-1.5 max-w-xs">
        <Label htmlFor="goalAmountDollars">Fundraising goal (USD)</Label>
        <Input
          id="goalAmountDollars"
          name="goalAmountDollars"
          type="number"
          step="0.01"
          min="0"
          defaultValue={goalAmountDollars}
          required
          inputMode="decimal"
        />
      </div>

      <div className="flex items-center justify-between gap-4 pt-2 border-t-2 border-ink/10">
        <div className="min-h-5">
          {err && <p className="text-sm text-ember-500">{err}</p>}
          {msg && <p className="text-sm text-royal-700">{msg}</p>}
        </div>
        <Button type="submit" variant="ember" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}
