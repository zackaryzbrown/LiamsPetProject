// Pure parsing / unit helpers — safe to import from both server and client
// components. No node built-ins, no secret env access.
//
// IMPORTANT: Field paths are best-effort because Pledge.to's webhook
// payload shape is not statically documented in this repo. Every "TODO:
// confirm" below is a hook for the operator to lock down once real
// sandbox payloads are observed. See README → "Pledge sandbox testing".

type Json = Record<string, unknown>;

const SUBMISSION_FIELD_KEY =
  process.env.NEXT_PUBLIC_PLEDGE_SUBMISSION_FIELD_KEY ??
  process.env.PLEDGE_SUBMISSION_FIELD_KEY ??
  "submission_id";

function readPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split(".")) {
    if (cur && typeof cur === "object" && p in (cur as Json)) {
      cur = (cur as Json)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function getString(obj: Json | undefined, ...paths: string[]): string | null {
  if (!obj) return null;
  for (const path of paths) {
    const v = readPath(obj, path);
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function getNumber(obj: Json | undefined, ...paths: string[]): number | null {
  if (!obj) return null;
  for (const path of paths) {
    const v = readPath(obj, path);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export type ParsedPledgeDonation = {
  // Top-level webhook event id — used for idempotency.
  eventId: string | null;
  // Donation/transaction id within the event payload.
  transactionId: string | null;
  // Money in cents. `amountCents` excludes tips/fees per spec.
  amountCents: number | null;
  tipCents: number;
  feeCents: number;
  currency: string;
  donorName: string | null;
  donorEmail: string | null;
  // Mapping signals (priority order, strongest first).
  customSubmissionId: string | null;
  mappingKey: string | null;
  widgetId: string | null;
  campaignId: string | null;
  fundraiserId: string | null;
  utmContent: string | null;
  // Event metadata.
  eventType: string | null;
  createdAt: string | null;
};

// =====================================================================
// parsePledgeWebhook
//
// Pledge.to v1 webhook envelopes vary by source (donation form, widget,
// fundraiser). We accept the common shapes and pick the strongest
// available signal for each field. Operators should add new field paths
// here as real payloads are observed.
// =====================================================================
export function parsePledgeWebhook(body: Json): ParsedPledgeDonation {
  // Donation object lives under one of these keys depending on event.
  const t: Json =
    ((body.data as Json | undefined) ??
      (body.donation as Json | undefined) ??
      (body.transaction as Json | undefined) ??
      (body.payload as Json | undefined) ??
      body) as Json;

  // TODO: confirm Pledge.to top-level event id field. Some integrations
  // expose it as `id` on the envelope, others as `event_id`.
  const eventId =
    getString(body, "id", "event_id", "event.id", "webhook_id") ??
    getString(t, "id", "uuid");

  // TODO: confirm the donation id field.
  const transactionId = getString(
    t,
    "id",
    "uuid",
    "donation_id",
    "transaction_id",
    "reference",
  );

  // TODO: confirm amount field & unit (cents vs dollars). We treat any
  // integer ≥ 1000 as already-in-cents, otherwise multiply.
  let amountCents = getNumber(
    t,
    "amount_cents",
    "amount_in_cents",
    "total_cents",
    "net_amount_cents",
  );
  if (amountCents == null) {
    const dollars = getNumber(t, "amount", "total", "donation_amount", "net_amount");
    if (dollars != null) {
      amountCents =
        Number.isInteger(dollars) && dollars >= 1000
          ? dollars
          : Math.round(dollars * 100);
    }
  }

  const tipCents =
    getNumber(t, "tip_cents", "tip_amount_cents", "tip.amount_cents") ??
    (() => {
      const tip = getNumber(t, "tip", "tip_amount");
      return tip != null ? Math.round(tip * 100) : 0;
    })();
  const feeCents =
    getNumber(t, "fee_cents", "processing_fee_cents", "platform_fee_cents") ??
    (() => {
      const fee = getNumber(t, "fee", "processing_fee", "platform_fee");
      return fee != null ? Math.round(fee * 100) : 0;
    })();
  const currency = getString(t, "currency", "currency_code") ?? "USD";

  const donorName = getString(
    t,
    "donor.name",
    "donor.full_name",
    "donor_name",
    "first_name",
    "name",
  );
  const donorEmail = getString(
    t,
    "donor.email",
    "donor_email",
    "email",
    "contact.email",
  );

  // Mapping signals (priority order, strongest first):
  //   1. Explicit custom field with our SUBMISSION_FIELD_KEY (pet UUID).
  //   2. mapping_key configured per-pet by admin.
  //   3. widget_id / campaign_id / fundraiser_id (1:1 with a pet).
  //   4. utm_content set to the pet UUID on the donation URL.
  const customSubmissionId =
    readCustomField(t, SUBMISSION_FIELD_KEY) ??
    getString(t, `metadata.${SUBMISSION_FIELD_KEY}`) ??
    getString(t, `meta.${SUBMISSION_FIELD_KEY}`) ??
    null;

  const mappingKey =
    readCustomField(t, "mapping_key") ??
    getString(t, "mapping_key", "metadata.mapping_key");

  const widgetId = getString(t, "widget_id", "widget.id", "metadata.widget_id");
  const campaignId = getString(t, "campaign_id", "campaign.id", "metadata.campaign_id");
  const fundraiserId = getString(
    t,
    "fundraiser_id",
    "fundraiser.id",
    "metadata.fundraiser_id",
  );

  const utmContent =
    getString(t, "utm_content", "utm.content", "tracking.utm_content") ?? null;

  const eventType = getString(body, "event", "event_type", "type") ?? null;
  const createdAt = getString(t, "created_at", "donated_at", "date");

  return {
    eventId,
    transactionId,
    amountCents,
    tipCents: tipCents ?? 0,
    feeCents: feeCents ?? 0,
    currency: currency.toUpperCase(),
    donorName,
    donorEmail,
    customSubmissionId,
    mappingKey,
    widgetId,
    campaignId,
    fundraiserId,
    utmContent,
    eventType,
    createdAt,
  };
}

function readCustomField(t: Json | undefined, key: string): string | null {
  if (!t) return null;
  // TODO: confirm Pledge.to custom-field shape — accept both array and
  // object variants until we know which one Pledge actually sends.
  const cf =
    (t as Json)["custom_fields"] ??
    (t as Json)["customFields"] ??
    (t as Json)["metadata"];
  if (Array.isArray(cf)) {
    for (const item of cf) {
      if (item && typeof item === "object") {
        const i = item as Json;
        const k = (i.key ?? i.name ?? i.slug) as unknown;
        const v = i.value as unknown;
        if (typeof k === "string" && k.toLowerCase() === key.toLowerCase()) {
          if (typeof v === "string") return v;
          if (typeof v === "number") return String(v);
        }
      }
    }
  } else if (cf && typeof cf === "object") {
    const v = (cf as Json)[key];
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

// =====================================================================
// $1 = 1 vote — always derived from amount_cents, never admin-set.
// =====================================================================
export function votesFromAmountCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents < 0) return 0;
  return Math.floor(amountCents / 100);
}

// =====================================================================
// Pet-entry fee. The first $10 of an entry donation covers the
// non-refundable contest entry; any overage is converted to spendable
// vote credits in the entrant's wallet.
// =====================================================================
export const ENTRY_FEE_CENTS = 1000;

// =====================================================================
// Donation-type classification
// =====================================================================
// TODO: confirm Pledge.to event-type strings. Until then, anything that
// looks like an entry/registration/ticket gets tagged as "entry" so the
// pet status transitions correctly.
const ENTRY_TYPES = new Set([
  "entry",
  "ticket",
  "ticket.purchased",
  "registration",
  "registration.completed",
]);

export function classifyDonationType(
  eventType: string | null,
  hasPetMapping: boolean,
): "entry" | "vote" | "general" | "unknown" {
  if (eventType && ENTRY_TYPES.has(eventType.toLowerCase())) return "entry";
  if (hasPetMapping) return "vote";
  if (eventType) return "general";
  return "unknown";
}

const NON_CREDITING_EVENT_PATTERNS = [
  /\brefund(ed)?\b/i,
  /\breversal\b/i,
  /\bchargeback\b/i,
  /\bdispute\b/i,
];

export function isNonCreditingPledgeEventType(eventType: string | null): boolean {
  if (!eventType) return false;
  return NON_CREDITING_EVENT_PATTERNS.some((pattern) => pattern.test(eventType));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v);
}
