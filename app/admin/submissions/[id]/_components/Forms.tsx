"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveSubmission,
  confirmEntryDonation,
  deleteSubmission,
  manualVoteAdjustment,
  rejectSubmission,
  updatePledgeLinks,
  type ActionResult,
} from "@/app/admin/actions";
import { Loader2 } from "lucide-react";

// =====================================================================
// Shared inline status renderer used by every admin form.
// =====================================================================
function StatusMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <p className="rounded-xl border-2 border-ink bg-cream-100 px-3 py-2 text-sm font-semibold">
        {result.message ?? "Saved."}
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="rounded-xl border-2 border-ember-500 bg-ember-50 px-3 py-2 text-sm text-ember-700"
    >
      {result.error}
    </p>
  );
}

// =====================================================================
// Approve photo & publish.
// =====================================================================
export function ApproveCard({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  return (
    <div className="ink-card p-5 grid gap-3">
      <p className="font-display text-xl font-black">Approve photo</p>
      <p className="text-sm text-ink-muted">
        Copies the photo to the public bucket and publishes the pet on the voting page.
      </p>
      <Button
        type="button"
        variant="ember"
        size="md"
        disabled={pending}
        onClick={() =>
          start(async () => setResult(await approveSubmission(submissionId)))
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Approve & publish
      </Button>
      <StatusMessage result={result} />
    </div>
  );
}

// =====================================================================
// Reject submission.
// =====================================================================
export function RejectCard({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  return (
    <form
      className="ink-card p-5 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("submissionId", submissionId);
        start(async () => setResult(await rejectSubmission(fd)));
      }}
    >
      <p className="font-display text-xl font-black">Reject</p>
      <div className="grid gap-2">
        <Label htmlFor="reason">Reason (shown to owner)</Label>
        <Textarea id="reason" name="reason" required rows={3} maxLength={500} />
      </div>
      <Button type="submit" variant="ghost" size="md" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Reject
      </Button>
      <StatusMessage result={result} />
    </form>
  );
}

// =====================================================================
// Manually confirm the $10 entry donation (cash/check fallback).
// =====================================================================
export function ConfirmEntryCard({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  return (
    <div className="ink-card p-5 grid gap-3">
      <p className="font-display text-xl font-black">Confirm entry donation</p>
      <p className="text-sm text-ink-muted">
        Use this if the donor paid the $10 outside Pledge.to. The webhook handles the normal
        case automatically.
      </p>
      <Button
        type="button"
        variant="royal"
        size="md"
        disabled={pending}
        onClick={() =>
          start(async () => setResult(await confirmEntryDonation(submissionId)))
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Mark entry paid
      </Button>
      <StatusMessage result={result} />
    </div>
  );
}

// =====================================================================
// Pledge.to per-pet links / mapping.
// =====================================================================
export function PledgeLinksForm({
  submissionId,
  initial,
}: {
  submissionId: string;
  initial: {
    pledgeDonationUrl: string | null;
    pledgeWidgetId: string | null;
    pledgeCampaignId: string | null;
    pledgeMappingKey: string | null;
  };
}) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  return (
    <form
      className="ink-card p-5 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("submissionId", submissionId);
        start(async () => setResult(await updatePledgeLinks(fd)));
      }}
    >
      <p className="font-display text-xl font-black">Pledge.to links</p>
      <p className="text-sm text-ink-muted">
        Any combination is fine. The webhook maps donations back to this pet using whichever
        signal is strongest (submission_id custom field &gt; mapping key &gt; widget id &gt;
        campaign id).
      </p>
      <div className="grid gap-2">
        <Label htmlFor="pledgeDonationUrl">Donation URL</Label>
        <Input
          id="pledgeDonationUrl"
          name="pledgeDonationUrl"
          type="url"
          defaultValue={initial.pledgeDonationUrl ?? ""}
          maxLength={500}
          placeholder="https://www.pledge.to/…"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="pledgeWidgetId">Widget ID</Label>
          <Input
            id="pledgeWidgetId"
            name="pledgeWidgetId"
            defaultValue={initial.pledgeWidgetId ?? ""}
            maxLength={120}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pledgeCampaignId">Campaign ID</Label>
          <Input
            id="pledgeCampaignId"
            name="pledgeCampaignId"
            defaultValue={initial.pledgeCampaignId ?? ""}
            maxLength={120}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pledgeMappingKey">Mapping key</Label>
        <Input
          id="pledgeMappingKey"
          name="pledgeMappingKey"
          defaultValue={initial.pledgeMappingKey ?? ""}
          maxLength={120}
          placeholder="Any unique identifier you'll attach to donations for this pet"
        />
      </div>
      <Button type="submit" variant="ember" size="md" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
      </Button>
      <StatusMessage result={result} />
    </form>
  );
}

// =====================================================================
// Manual vote adjustment (audit-logged on the DB side).
// =====================================================================
export function ManualVoteForm({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  return (
    <form
      className="ink-card p-5 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("submissionId", submissionId);
        start(async () => setResult(await manualVoteAdjustment(fd)));
      }}
    >
      <p className="font-display text-xl font-black">Manual vote adjustment</p>
      <p className="text-sm text-ink-muted">
        Use for offline donations (cash/check) or corrections. Enter dollars — $1 = 1 vote.
        Negative amounts subtract. Every change is permanently audit-logged.
      </p>
      <div className="grid sm:grid-cols-[160px_1fr] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="amountDollars">Amount (USD)</Label>
          <Input
            id="amountDollars"
            name="amountDollars"
            type="number"
            step="0.01"
            required
            placeholder="50"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="reason">Reason</Label>
          <Input id="reason" name="reason" required maxLength={500} placeholder="Cash donation at event" />
        </div>
      </div>
      <Button type="submit" variant="royal" size="md" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Record adjustment
      </Button>
      <StatusMessage result={result} />
    </form>
  );
}

// =====================================================================
// Permanently remove submission + files.
// =====================================================================
export function RemoveCard({
  submissionId,
  petName,
}: {
  submissionId: string;
  petName: string;
}) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  return (
    <div className="ink-card p-5 grid gap-3 border-ember-500">
      <p className="font-display text-xl font-black">Danger zone</p>
      <p className="text-sm text-ink-muted">
        Permanently deletes the submission row and removes the photo from both storage buckets.
        Cannot be undone.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="md"
        className="text-ember-700 hover:bg-ember-50"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Permanently remove "${petName}"?`)) return;
          start(async () => setResult(await deleteSubmission(submissionId)));
        }}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Remove permanently
      </Button>
      <StatusMessage result={result} />
    </div>
  );
}
