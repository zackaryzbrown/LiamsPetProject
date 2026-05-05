"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { dismissWebhookEvent, linkWebhookToPet } from "../actions";
import { parseTransaction, votesFromAmountCents } from "@/lib/givebutter-parse";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Link2, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type EventRow = {
  id: string;
  eventType: string | null;
  signatureValid: boolean;
  receivedAt: string;
  error: string | null;
  payload: Record<string, unknown>;
};

type PetOption = { id: string; label: string };

export function ReconcileRow({
  event,
  petOptions,
}: {
  event: EventRow;
  petOptions: PetOption[];
}) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [showRaw, setShowRaw] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Re-parse client-side so admins can see what we extracted.
  const parsed = React.useMemo(() => parseTransaction(event.payload), [event.payload]);
  const votes = parsed.amountCents != null ? votesFromAmountCents(parsed.amountCents) : null;

  const filtered = React.useMemo(() => {
    if (!query.trim()) return petOptions.slice(0, 20);
    const q = query.toLowerCase();
    return petOptions.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 20);
  }, [petOptions, query]);

  return (
    <Card>
      <CardContent className="p-5 grid gap-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={event.signatureValid ? "royal" : "ember"}>
                {event.signatureValid ? "Signed" : "Unsigned"}
              </Badge>
              {event.eventType && <Badge tone="cream">{event.eventType}</Badge>}
              <span className="text-xs text-ink-muted">
                {new Date(event.receivedAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 font-display text-lg font-black break-all">
              {parsed.transactionId ?? <span className="text-ink-muted">(no transaction id)</span>}
            </p>
            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Meta
                label="Amount"
                value={parsed.amountCents != null ? formatCurrency(parsed.amountCents) : "-"}
              />
              <Meta label="Votes" value={votes != null ? votes.toLocaleString() : "-"} />
              <Meta label="Donor" value={parsed.donorName ?? "-"} />
              <Meta label="Email" value={parsed.donorEmail ?? "-"} />
              <Meta label="Custom field" value={parsed.customSubmissionId ?? "-"} />
              <Meta label="utm_content" value={parsed.utmContent ?? "-"} />
              <Meta label="member_id" value={parsed.memberId ?? "-"} />
              <Meta label="member slug" value={parsed.memberSlug ?? "-"} />
            </dl>
            {event.error && (
              <p className="mt-2 text-xs text-ember-500">Error: {event.error}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="text-xs underline text-ink-muted inline-flex items-center gap-1"
          >
            {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showRaw ? "Hide raw" : "View raw"}
          </button>
        </div>

        {showRaw && (
          <pre className="text-xs bg-ink text-cream p-3 rounded-xl overflow-x-auto max-h-80">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}

        <div className="grid gap-3 md:grid-cols-2 pt-3 border-t-2 border-ink/10">
          <form
            action={(fd) =>
              start(async () => {
                setMsg(null);
                setErr(null);
                fd.set("rawEventId", event.id);
                const r = await linkWebhookToPet(fd);
                if (r.ok) setMsg(r.message);
                else setErr(r.error);
              })
            }
            className="grid gap-2 p-4 rounded-xl border-2 border-dashed border-ink/30 bg-cream-100"
          >
            <p className="eyebrow text-royal-700">Link to pet</p>
            <Label htmlFor={`search-${event.id}`}>Search by pet, owner, or email</Label>
            <Input
              id={`search-${event.id}`}
              type="search"
              placeholder="Type to filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Label htmlFor={`pet-${event.id}`}>Pet</Label>
            <select
              id={`pet-${event.id}`}
              name="petSubmissionId"
              required
              className="h-12 w-full rounded-xl border-2 border-ink bg-white px-4 text-base"
            >
              <option value="">Select a pet…</option>
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="ember" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Link & record
            </Button>
          </form>

          <form
            action={(fd) =>
              start(async () => {
                setMsg(null);
                setErr(null);
                fd.set("rawEventId", event.id);
                const r = await dismissWebhookEvent(fd);
                if (r.ok) setMsg(r.message);
                else setErr(r.error);
              })
            }
            className="grid gap-2 p-4 rounded-xl border-2 border-dashed border-ink/30 bg-cream-100"
          >
            <p className="eyebrow text-ember-500">Dismiss</p>
            <Label htmlFor={`dismiss-${event.id}`}>Reason</Label>
            <Input
              id={`dismiss-${event.id}`}
              name="reason"
              required
              placeholder="e.g. test fire / refund / not for this contest"
            />
            <Button
              type="submit"
              variant="ghost"
              disabled={pending}
              className="border-ember-500 text-ember-500 hover:bg-ember-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Dismiss event
            </Button>
          </form>
        </div>

        {(msg || err) && (
          <p className={err ? "text-sm text-ember-500" : "text-sm text-royal-700"}>
            {err ?? msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <dt className="text-[10px] uppercase tracking-widest text-ink-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
