"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  dismissWebhookEvent,
  linkWebhookToPet,
  type ReconcileResult,
} from "@/app/admin/reconciliation/actions";
import { parsePledgeWebhook } from "@/lib/pledge-parse";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type EventRow = {
  id: string;
  pledgeEventId: string | null;
  eventType: string | null;
  signatureVerified: boolean;
  errorMessage: string | null;
  createdAt: string;
  rawPayload: Record<string, unknown>;
};

type Props = {
  event: EventRow;
  petOptions: { id: string; label: string }[];
};

function Status({ result }: { result: ReconcileResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <p className="rounded-xl border-2 border-ink bg-cream-100 px-3 py-2 text-xs font-semibold">
        {result.message ?? "Done."}
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="rounded-xl border-2 border-ember-500 bg-ember-50 px-3 py-2 text-xs text-ember-700"
    >
      {result.error}
    </p>
  );
}

// =====================================================================
// One unmapped webhook row. Shows everything we managed to parse so the
// admin can confidently pick the right pet — or dismiss the event.
// =====================================================================
export function ReconcileRow({ event, petOptions }: Props) {
  const parsed = React.useMemo(
    () => parsePledgeWebhook(event.rawPayload),
    [event.rawPayload],
  );

  const [linkPending, linkStart] = React.useTransition();
  const [linkResult, setLinkResult] = React.useState<ReconcileResult | null>(null);
  const [dismissPending, dismissStart] = React.useTransition();
  const [dismissResult, setDismissResult] = React.useState<ReconcileResult | null>(null);
  const [rawOpen, setRawOpen] = React.useState(false);

  return (
    <div className="ink-card overflow-hidden">
      <header className="p-4 border-b-2 border-ink bg-cream-100 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={event.signatureVerified ? "ink" : "ember"}>
            {event.signatureVerified ? "signature ok" : "unsigned"}
          </Badge>
          <Badge tone="cream">{event.eventType ?? "no event type"}</Badge>
          <span className="font-mono text-xs break-all text-ink-muted">
            {event.pledgeEventId ?? "no event id"}
          </span>
        </div>
        <p className="text-xs text-ink-muted whitespace-nowrap">
          {new Date(event.createdAt).toLocaleString()}
        </p>
      </header>

      <div className="p-5 grid gap-5 md:grid-cols-2">
        <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
          <dt className="text-ink-muted">Amount</dt>
          <dd className="font-semibold tabular-nums">
            {parsed.amountCents != null ? formatCurrency(parsed.amountCents) : "—"}
            {parsed.tipCents > 0 && (
              <span className="ml-2 text-xs text-ink-muted">
                +{formatCurrency(parsed.tipCents)} tip
              </span>
            )}
          </dd>
          <dt className="text-ink-muted">Donor</dt>
          <dd>{parsed.donorName ?? "—"}<div className="text-xs text-ink-muted">{parsed.donorEmail ?? ""}</div></dd>
          <dt className="text-ink-muted">Transaction id</dt>
          <dd className="font-mono text-xs break-all">{parsed.transactionId ?? "—"}</dd>
          <dt className="text-ink-muted">Mapping key</dt>
          <dd className="font-mono text-xs break-all">{parsed.mappingKey ?? "—"}</dd>
          <dt className="text-ink-muted">Widget id</dt>
          <dd className="font-mono text-xs break-all">{parsed.widgetId ?? "—"}</dd>
          <dt className="text-ink-muted">Campaign id</dt>
          <dd className="font-mono text-xs break-all">{parsed.campaignId ?? "—"}</dd>
          <dt className="text-ink-muted">Fundraiser id</dt>
          <dd className="font-mono text-xs break-all">{parsed.fundraiserId ?? "—"}</dd>
          <dt className="text-ink-muted">submission_id field</dt>
          <dd className="font-mono text-xs break-all">{parsed.customSubmissionId ?? "—"}</dd>
          <dt className="text-ink-muted">utm_content</dt>
          <dd className="font-mono text-xs break-all">{parsed.utmContent ?? "—"}</dd>
          {event.errorMessage && (
            <>
              <dt className="text-ink-muted">Last error</dt>
              <dd className="text-ember-700">{event.errorMessage}</dd>
            </>
          )}
        </dl>

        <div className="grid gap-4">
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("eventRowId", event.id);
              linkStart(async () => setLinkResult(await linkWebhookToPet(fd)));
            }}
          >
            <Label htmlFor={`pet-${event.id}`}>Link to pet</Label>
            <select
              id={`pet-${event.id}`}
              name="petSubmissionId"
              required
              defaultValue=""
              className="h-12 w-full rounded-xl border-2 border-ink bg-white px-3 text-sm"
            >
              <option value="" disabled>
                Choose a pet…
              </option>
              {petOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="ember" size="sm" disabled={linkPending}>
              {linkPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Link & apply votes
            </Button>
            <Status result={linkResult} />
          </form>

          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("eventRowId", event.id);
              dismissStart(async () => setDismissResult(await dismissWebhookEvent(fd)));
            }}
          >
            <Label htmlFor={`reason-${event.id}`}>Dismiss reason</Label>
            <Input
              id={`reason-${event.id}`}
              name="reason"
              required
              maxLength={500}
              placeholder="Test data / duplicate / refund / etc."
            />
            <Button type="submit" variant="ghost" size="sm" disabled={dismissPending}>
              {dismissPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Dismiss
            </Button>
            <Status result={dismissResult} />
          </form>
        </div>
      </div>

      <details
        className="border-t-2 border-ink bg-cream-100"
        open={rawOpen}
        onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-5 py-3 text-xs font-semibold uppercase tracking-wider">
          Raw payload
        </summary>
        <pre className="px-5 pb-5 text-xs whitespace-pre-wrap break-all">
          {JSON.stringify(event.rawPayload, null, 2)}
        </pre>
      </details>
    </div>
  );
}
