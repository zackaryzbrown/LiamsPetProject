"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveSubmission,
  addVoteCredits,
  confirmEntryDonation,
  deleteSubmission,
  manualVoteAdjustment,
  rejectSubmission,
  updateGivebutterLinks,
} from "@/app/admin/actions";
import { Check, CircleDollarSign, Coins, Loader2, Trash2, X } from "lucide-react";

function Status({ message, error }: { message?: string | null; error?: string | null }) {
  if (error) return <p className="text-sm text-ember-500">{error}</p>;
  if (message) return <p className="text-sm text-royal-700">{message}</p>;
  return null;
}

export function ApproveCard({
  submissionId,
  alreadyApproved,
}: {
  submissionId: string;
  alreadyApproved: boolean;
}) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <Card>
      <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-royal-700">{alreadyApproved ? "Already live" : "Ready to publish"}</p>
          <h2 className="font-display text-2xl font-black">
            {alreadyApproved ? "Re-publish photo" : "Approve & publish"}
          </h2>
          <p className="text-sm text-ink-muted">
            Copies the photo to the public bucket and sets status to approved.
          </p>
          <Status message={msg} error={err} />
        </div>
        <Button
          type="button"
          variant="ember"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              setErr(null);
              const r = await approveSubmission(submissionId);
              if (r.ok) setMsg(r.message ?? "Approved.");
              else setErr(r.error);
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {alreadyApproved ? "Re-publish" : "Approve"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ConfirmEntryCard({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <Card>
      <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-royal-700">Awaiting payment</p>
          <h2 className="font-display text-2xl font-black">Mark entry donation confirmed</h2>
          <p className="text-sm text-ink-muted">
            Use this if Givebutter isn&apos;t wired up or the donation came through another
            channel. Records a $10 entry transaction and moves the submission to <em>pending
            review</em> so it can be approved.
          </p>
          <Status message={msg} error={err} />
        </div>
        <Button
          type="button"
          variant="ink"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              setErr(null);
              const r = await confirmEntryDonation(submissionId);
              if (r.ok) setMsg(r.message ?? "Confirmed.");
              else setErr(r.error);
            })
          }
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CircleDollarSign className="h-4 w-4" />
          )}
          Confirm $10 entry
        </Button>
      </CardContent>
    </Card>
  );
}

export function RejectCard({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <Card>
      <CardContent className="p-6 grid gap-3">
        <div>
          <p className="eyebrow text-royal-700">Reject</p>
          <h2 className="font-display text-2xl font-black">Reject this submission</h2>
          <p className="text-sm text-ink-muted">
            The photo will be removed from the public site (if it was already published).
          </p>
        </div>
        <form
          action={(fd) =>
            start(async () => {
              setMsg(null);
              setErr(null);
              fd.set("submissionId", submissionId);
              const r = await rejectSubmission(fd);
              if (r.ok) setMsg(r.message ?? "Rejected.");
              else setErr(r.error);
            })
          }
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`reason-${submissionId}`}>Reason</Label>
            <Textarea
              id={`reason-${submissionId}`}
              name="reason"
              required
              rows={3}
              placeholder="Photo is blurry / not the owner's pet / etc."
            />
          </div>
          <div className="flex items-center justify-between">
            <Status message={msg} error={err} />
            <Button type="submit" variant="ink" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reject
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function GivebutterLinksForm({
  submissionId,
  memberUrl,
  memberId,
}: {
  submissionId: string;
  memberUrl: string;
  memberId: string;
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
          fd.set("submissionId", submissionId);
          const r = await updateGivebutterLinks(fd);
          if (r.ok) setMsg(r.message ?? "Saved.");
          else setErr(r.error);
        })
      }
      className="grid gap-3"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`gbUrl-${submissionId}`}>Givebutter member / vote URL</Label>
        <Input
          id={`gbUrl-${submissionId}`}
          name="givebutterMemberUrl"
          defaultValue={memberUrl}
          placeholder="https://givebutter.com/..."
          inputMode="url"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`gbId-${submissionId}`}>Givebutter member ID (optional)</Label>
        <Input
          id={`gbId-${submissionId}`}
          name="givebutterMemberId"
          defaultValue={memberId}
          placeholder="e.g. 1234567"
        />
      </div>
      <div className="flex items-center justify-between">
        <Status message={msg} error={err} />
        <Button type="submit" variant="ink" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save links
        </Button>
      </div>
    </form>
  );
}

export function AddCreditsForm({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          setErr(null);
          fd.set("submissionId", submissionId);
          const r = await addVoteCredits(fd);
          if (r.ok) setMsg(r.message ?? "Credited.");
          else setErr(r.error);
        })
      }
      className="grid gap-3 p-4 rounded-xl border-2 border-dashed border-royal-700/30 bg-royal-50"
    >
      <p className="eyebrow text-royal-700 flex items-center gap-2">
        <Coins className="h-3.5 w-3.5" /> Give vote credits to this owner
      </p>
      <p className="text-sm text-ink-muted">
        Records an off-Givebutter donation as <strong>credits</strong> attached to this
        submission&apos;s owner. They&apos;ll see the balance on their account page and can
        split votes across any approved pet. $1 = 1 vote.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="grid gap-1.5">
          <Label htmlFor={`credit-amt-${submissionId}`}>Amount (USD)</Label>
          <Input
            id={`credit-amt-${submissionId}`}
            name="amountDollars"
            type="number"
            min="1"
            step="0.01"
            defaultValue="0"
            inputMode="decimal"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`credit-note-${submissionId}`}>Note</Label>
          <Input
            id={`credit-note-${submissionId}`}
            name="note"
            placeholder="e.g. $150 cash from owner, receipt #4"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Status message={msg} error={err} />
        <Button type="submit" variant="ink" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add credits
        </Button>
      </div>
    </form>
  );
}

export function ManualVoteForm({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          setErr(null);
          fd.set("submissionId", submissionId);
          const r = await manualVoteAdjustment(fd);
          if (r.ok) setMsg(r.message ?? "Recorded.");
          else setErr(r.error);
        })
      }
      className="grid gap-3 p-4 rounded-xl border-2 border-dashed border-ink/30 bg-cream-100"
    >
      <p className="eyebrow text-royal-700">Reconcile off-Givebutter donation</p>
      <p className="text-sm text-ink-muted">
        Use only for cash/check donations that didn&apos;t flow through Givebutter. Votes are
        always <strong>$1 = 1 vote</strong> and computed from the amount &mdash; admins do not
        set vote counts directly. Use a negative amount to record a refund.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor={`amt-${submissionId}`}>Amount (USD)</Label>
        <Input
          id={`amt-${submissionId}`}
          name="amountDollars"
          type="number"
          step="0.01"
          defaultValue="0"
          inputMode="decimal"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`note-${submissionId}`}>Note</Label>
        <Input
          id={`note-${submissionId}`}
          name="note"
          required
          placeholder="e.g. $20 cash from event table, receipt #12"
        />
      </div>
      <div className="flex items-center justify-between">
        <Status message={msg} error={err} />
        <Button type="submit" variant="ink" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Record adjustment
        </Button>
      </div>
    </form>
  );
}

export function RemoveCard({
  submissionId,
  petName,
}: {
  submissionId: string;
  petName: string;
}) {
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const router = useRouter();
  return (
    <Card>
      <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-ember-500">Danger zone</p>
          <h2 className="font-display text-2xl font-black">Remove submission</h2>
          <p className="text-sm text-ink-muted">
            Permanently deletes this submission and its photo files. Vote transactions will lose
            their pet link but remain in the audit log.
          </p>
          <Status error={err} />
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          className="border-ember-500 text-ember-500 hover:bg-ember-50"
          onClick={() => {
            if (!window.confirm(`Permanently remove "${petName}"?`)) return;
            start(async () => {
              setErr(null);
              const r = await deleteSubmission(submissionId);
              if (r.ok) router.push("/admin/submissions");
              else setErr(r.error);
            });
          }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Remove permanently
        </Button>
      </CardContent>
    </Card>
  );
}
