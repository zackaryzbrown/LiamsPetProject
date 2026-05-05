import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReconcileRow } from "./_components/ReconcileRow";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  const admin = createAdminClient();

  const [{ data: events }, { data: pets }] = await Promise.all([
    admin
      .from("webhook_events_raw")
      .select("id, event_type, signature_valid, matched, payload, error, received_at")
      .eq("matched", false)
      .order("received_at", { ascending: false })
      .limit(100),
    admin
      .from("pet_submissions")
      .select("id, pet_name, owner_name, owner_email, status")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const petOptions = (pets ?? []).map((p) => ({
    id: p.id as string,
    label: `${p.pet_name as string} - ${p.owner_name as string} (${p.owner_email as string}) · ${p.status}`,
  }));

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-royal-700">Reconciliation</p>
          <h1 className="font-display text-4xl font-black">Unmatched webhooks</h1>
          <p className="text-ink-muted mt-1 max-w-prose">
            Webhook events that we couldn&apos;t automatically map to a pet. Link them to the
            correct pet, or dismiss if they shouldn&apos;t be counted (test fires, refunds, etc.).
          </p>
        </div>
        <Badge tone={events && events.length > 0 ? "ember" : "royal"}>
          {events?.length ?? 0} pending
        </Badge>
      </div>

      {(events?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-ink-muted">
            Nothing to reconcile.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {(events ?? []).map((e) => (
          <ReconcileRow
            key={e.id as string}
            event={{
              id: e.id as string,
              eventType: (e.event_type as string | null) ?? null,
              signatureValid: !!e.signature_valid,
              receivedAt: e.received_at as string,
              error: (e.error as string | null) ?? null,
              payload: (e.payload as Record<string, unknown>) ?? {},
            }}
            petOptions={petOptions}
          />
        ))}
      </div>
    </div>
  );
}
