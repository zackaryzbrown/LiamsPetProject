"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveSubmission,
  deleteSubmission,
  manualVoteAdjustment,
  rejectSubmission,
  updateGivebutterLinks,
} from "@/app/admin/actions";
import { Check, Loader2, Trash2, X } from "lucide-react";

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
      <p className="eyebrow text-royal-700">Manual adjustment</p>
      <p className="text-sm text-ink-muted">
        Use this if Givebutter sync drifts. Negative numbers subtract. Recorded as a manual
        transaction with your admin email.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
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
          <Label htmlFor={`votes-${submissionId}`}>Votes</Label>
          <Input
            id={`votes-${submissionId}`}
            name="votes"
            type="number"
            step="1"
            defaultValue="0"
            inputMode="numeric"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`note-${submissionId}`}>Note</Label>
        <Input
          id={`note-${submissionId}`}
          name="note"
          placeholder="e.g. Cash donation reconciled with Givebutter txn 4567"
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
