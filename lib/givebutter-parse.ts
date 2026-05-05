// Pure parsing / unit helpers — safe to import from both server and client
// components. No node built-ins, no secret env access.

type Json = Record<string, unknown>;

// Read GIVEBUTTER_SUBMISSION_FIELD_KEY off NEXT_PUBLIC if available, else
// default. We deliberately avoid importing lib/env.ts here so this module
// stays client-safe.
const SUBMISSION_FIELD_KEY =
  process.env.NEXT_PUBLIC_GIVEBUTTER_SUBMISSION_FIELD_KEY ??
  process.env.GIVEBUTTER_SUBMISSION_FIELD_KEY ??
  "submission_id";

function getString(obj: Json | undefined, ...paths: string[]): string | null {
  if (!obj) return null;
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Json)) {
        cur = (cur as Json)[p];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.length > 0) return cur;
    if (typeof cur === "number") return String(cur);
  }
  return null;
}

function getNumber(obj: Json | undefined, ...paths: string[]): number | null {
  const s = getString(obj, ...paths);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type ParsedTransaction = {
  transactionId: string | null;
  amountCents: number | null;
  donorName: string | null;
  donorEmail: string | null;
  customSubmissionId: string | null;
  utmContent: string | null;
  memberId: string | null;
  memberSlug: string | null;
  campaignId: string | null;
  eventType: string | null;
  createdAt: string | null;
};

// =====================================================================
// IMPORTANT: Field paths below are best-effort. Confirm against Givebutter
// docs/dashboard and remove the fallback chains once locked in.
// =====================================================================
export function parseTransaction(body: Json): ParsedTransaction {
  const t: Json | undefined =
    (body.data as Json | undefined) ??
    (body.transaction as Json | undefined) ??
    (body.payload as Json | undefined) ??
    body;

  // TODO: Confirm canonical Givebutter transaction id field.
  const transactionId = getString(t, "id", "transaction_id", "uuid", "reference");

  // TODO: Confirm whether Givebutter sends amount in cents or dollars.
  let amountCents = getNumber(t, "amount_cents", "amount_in_cents", "total_cents");
  if (amountCents == null) {
    const dollars = getNumber(t, "amount", "total", "donation_amount");
    if (dollars != null) {
      amountCents = Number.isInteger(dollars) && dollars >= 1000
        ? dollars
        : Math.round(dollars * 100);
    }
  }

  // TODO: Confirm donor field paths.
  const donorName = getString(
    t,
    "donor.name",
    "donor.full_name",
    "contact.name",
    "first_name",
    "donor_name",
  );
  const donorEmail = getString(t, "donor.email", "contact.email", "email", "donor_email");

  // TODO: Confirm custom_fields shape.
  const customSubmissionId =
    readCustomField(t, SUBMISSION_FIELD_KEY) ??
    getString(t, `metadata.${SUBMISSION_FIELD_KEY}`) ??
    null;

  const utmContent =
    getString(t, "utm_content", "utm.content", "tracking.utm_content") ?? null;

  // TODO: Confirm Givebutter member identifier field.
  const memberId = getString(t, "member_id", "team_member_id", "member.id");
  const memberSlug = getString(t, "member.slug", "member.url", "fundraiser.slug");

  const campaignId = getString(t, "campaign_id", "campaign.id");
  const eventType = getString(body, "event", "type", "event_type") ?? null;
  const createdAt = getString(t, "created_at", "transaction_date", "date");

  return {
    transactionId,
    amountCents,
    donorName,
    donorEmail,
    customSubmissionId,
    utmContent,
    memberId,
    memberSlug,
    campaignId,
    eventType,
    createdAt,
  };
}

// TODO: Confirm Givebutter custom_fields shape (array vs object).
function readCustomField(t: Json | undefined, key: string): string | null {
  if (!t) return null;
  const cf = (t as Json)["custom_fields"] ?? (t as Json)["customFields"];
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
// $1 = 1 vote
// =====================================================================
export function votesFromAmountCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents < 0) return 0;
  return Math.floor(amountCents / 100);
}

// =====================================================================
// Event-type classification
// =====================================================================
// TODO: Confirm Givebutter event names.
const ENTRY_EVENT_TYPES = new Set([
  "entry",
  "ticket.purchased",
  "registration.completed",
]);

export function classifyKind(eventType: string | null): "entry" | "vote" {
  if (!eventType) return "vote";
  return ENTRY_EVENT_TYPES.has(eventType.toLowerCase()) ? "entry" : "vote";
}
