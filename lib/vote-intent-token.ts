import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

type VoteIntentTokenPayload = {
  v: 1;
  intentId: string;
  petSubmissionId: string;
  exp: string;
};

function getSigningSecret(): string {
  const secret = env.PLEDGE_INTENT_SIGNING_SECRET ?? env.PLEDGE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("PLEDGE_INTENT_SIGNING_SECRET or PLEDGE_WEBHOOK_SECRET is required");
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function createVoteIntentToken(input: {
  intentId: string;
  petSubmissionId: string;
  expiresAt: string;
}): string {
  const payload: VoteIntentTokenPayload = {
    v: 1,
    intentId: input.intentId,
    petSubmissionId: input.petSubmissionId,
    exp: input.expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyVoteIntentToken(
  token: string | null | undefined,
): VoteIntentTokenPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".", 2);
  if (!encodedPayload || !signature) return null;
  if (!safeEqual(signature, sign(encodedPayload))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<VoteIntentTokenPayload>;
    if (
      payload.v !== 1 ||
      typeof payload.intentId !== "string" ||
      typeof payload.petSubmissionId !== "string" ||
      typeof payload.exp !== "string"
    ) {
      return null;
    }
    const expiresAt = new Date(payload.exp).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return {
      v: 1,
      intentId: payload.intentId,
      petSubmissionId: payload.petSubmissionId,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
