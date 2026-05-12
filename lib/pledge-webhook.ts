import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

// =====================================================================
// Pledge.to webhook signature verification.
//
// Pledge sends an HMAC-SHA256 of the raw request body using your webhook
// signing secret. The header name is `Pledgeling-Signature` per Pledge's
// docs (Pledge / Pledgeling are the same product). Some installations
// also support a raw alias — try all of them.
//
// TODO: Confirm against your Pledge dashboard:
//   * exact header name
//   * whether the signature is hex/base64
//   * whether they prefix with "sha256=" (Stripe-style) or use a
//     comma-separated key=value form
// =====================================================================
export const PLEDGE_SIGNATURE_HEADERS = [
  "pledgeling-signature",
  "x-pledgeling-signature",
  "pledge-signature",
  "x-pledge-signature",
  "x-webhook-signature",
] as const;

export function extractPledgeSignature(headers: Headers): string | null {
  for (const h of PLEDGE_SIGNATURE_HEADERS) {
    const v = headers.get(h);
    if (v) return v.trim();
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function verifyPledgeSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = env.PLEDGE_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;

  const hmacHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const hmacB64 = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  // Compare against the raw header value AND common envelope forms.
  const candidates = [
    signature,
    signature.replace(/^sha256=/i, ""),
    signature.replace(/^hmac-sha256=/i, ""),
  ];
  for (const c of candidates) {
    if (safeEqual(c, hmacHex)) return true;
    if (safeEqual(c, hmacB64)) return true;
  }
  return false;
}

// Convert request headers into a flat JSON object we can store on
// pledge_webhook_events for debugging. Drops obviously sensitive keys.
const REDACTED_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);
export function captureHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (REDACTED_HEADERS.has(key.toLowerCase())) return;
    out[key] = value;
  });
  return out;
}
