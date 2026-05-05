import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

// Server-only signature verification helpers. Pure parsing helpers live in
// lib/givebutter-parse.ts so client components can safely import them.

// TODO: Confirm header name AND whether Givebutter prepends an algorithm
// prefix (e.g., "sha256=...") or sends a hex/base64 digest only.
export const SIGNATURE_HEADERS = [
  "x-givebutter-signature",
  "givebutter-signature",
  "x-webhook-signature",
] as const;

export function extractSignature(headers: Headers): string | null {
  for (const h of SIGNATURE_HEADERS) {
    const v = headers.get(h);
    if (v) return v.trim();
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// TODO: Confirm whether Givebutter signs the raw body, or a canonicalized
// form including a timestamp (Stripe-style "t=...,v1=...").
export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!env.GIVEBUTTER_WEBHOOK_SECRET) return false;
  if (!signature) return false;
  const hmac = crypto
    .createHmac("sha256", env.GIVEBUTTER_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqual(signature, hmac) || safeEqual(signature, `sha256=${hmac}`);
}

export {
  parseTransaction,
  votesFromAmountCents,
  classifyKind,
  type ParsedTransaction,
} from "@/lib/givebutter-parse";
