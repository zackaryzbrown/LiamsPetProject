"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { approveSubmission, deleteSubmission } from "@/app/admin/actions";
import { Check, Trash2, Loader2 } from "lucide-react";

export function ApproveButton({ submissionId }: { submissionId: string }) {
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ember"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await approveSubmission(submissionId);
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Approve
      </Button>
      {error && <span className="text-xs text-ember-500">{error}</span>}
    </div>
  );
}

export function DeleteButton({
  submissionId,
  petName,
}: {
  submissionId: string;
  petName: string;
}) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Permanently remove "${petName}" and its photo?`)) return;
        start(async () => {
          await deleteSubmission(submissionId);
        });
      }}
      className="text-ember-500 hover:bg-ember-50"
      aria-label={`Remove ${petName}`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      Remove
    </Button>
  );
}
