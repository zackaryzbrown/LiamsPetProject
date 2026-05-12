import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { ReconcileRow } from "./_components/ReconcileRow";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  const admin = createAdminClient();

  const [{ data: events }, { data: pets }] = await Promise.all([
    admin
      .from("pledge_webhook_events")
      .select(
        "id, pledge_event_id, event_type, signature_verified, processing_status, error_message, raw_payload, created_at",
      )
      .eq("processing_status", "unmapped")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("pet_submissions")
      .select("id, pet_name, owner_name, status")
      .in("status", ["approved", "pending_review", "pending_payment"])
      .order("pet_name", { ascending: true }),
  ]);

  const petOptions = (pets ?? []).map((p) => ({
    id: p.id,
    label: `${p.pet_name} — ${p.owner_name} (${p.status})`,
  }));

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-black tracking-tight">Reconciliation</h1>
        <p className="text-ink-muted">
          Pledge.to donations the webhook could not automatically map to a pet. Link them to the
          right pet, or dismiss them if they&apos;re test data.
        </p>
      </header>

      {(!events || events.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center grid gap-2">
            <p className="font-display text-2xl font-black">All clear.</p>
            <p className="text-ink-muted">No unmapped donations right now.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {(events ?? []).map((ev) => (
          <ReconcileRow
            key={ev.id}
            event={{
              id: ev.id,
              pledgeEventId: ev.pledge_event_id,
              eventType: ev.event_type,
              signatureVerified: ev.signature_verified,
              errorMessage: ev.error_message,
              createdAt: ev.created_at,
              rawPayload: ev.raw_payload as Record<string, unknown>,
            }}
            petOptions={petOptions}
          />
        ))}
      </div>
    </div>
  );
}
