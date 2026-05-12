#!/usr/bin/env node
/**
 * Simulate a Pledge.to webhook hitting our production endpoint.
 *
 * Usage:
 *   PLEDGE_WEBHOOK_SECRET=... \
 *     node scripts/simulate-pledge-webhook.mjs <submission_id> [amount_dollars] [type]
 *
 *   <submission_id>    REQUIRED. UUID of pet_submissions row (from the redirect URL).
 *   [amount_dollars]   Optional. Defaults to 10 (= entry donation, flips status).
 *   [type]             Optional. "donation.completed" (default) or "donation.refunded".
 *
 * Examples:
 *   node scripts/simulate-pledge-webhook.mjs 6781f2bf-bd04-4554-9ee1-be172dec7062
 *   node scripts/simulate-pledge-webhook.mjs 6781f2bf-bd04-4554-9ee1-be172dec7062 25
 *
 * Reads PLEDGE_WEBHOOK_SECRET (or PLEDGE_API_KEY) and TARGET_URL from env.
 */

import crypto from "node:crypto";

const [, , submissionId, amountArg, typeArg] = process.argv;
if (!submissionId) {
  console.error("Missing <submission_id>. Pass the UUID from the /enter redirect URL.");
  process.exit(1);
}

const targetUrl =
  process.env.TARGET_URL ??
  "https://main.derbbj6vexl0w.amplifyapp.com/api/webhooks/pledge";
const secret =
  process.env.PLEDGE_WEBHOOK_SECRET ?? process.env.PLEDGE_API_KEY;
if (!secret) {
  console.error("Set PLEDGE_WEBHOOK_SECRET (or PLEDGE_API_KEY) in the env.");
  process.exit(1);
}

const amountCents = Math.round(Number(amountArg ?? "10") * 100);
const eventType = typeArg ?? "donation.completed";
const eventId = `evt_test_${crypto.randomBytes(8).toString("hex")}`;
const txId = `txn_test_${crypto.randomBytes(8).toString("hex")}`;

// Mirrors what Pledge.to actually sends — our parser supports both
// the flat-object and nested-`data` shapes; we use the nested form
// because that is the more common pattern across donation platforms.
const payload = {
  id: eventId,
  type: eventType,
  created_at: new Date().toISOString(),
  data: {
    id: txId,
    amount: amountCents,            // cents
    tip_amount: 0,
    fee_amount: 0,
    currency: "USD",
    donor: {
      name: "Test Donor",
      email: "test+webhook@example.com",
    },
    custom_fields: {
      submission_id: submissionId,
    },
    utm_content: submissionId,
    campaign_id: process.env.PLEDGE_DEFAULT_CAMPAIGN_ID ?? null,
    widget_id: process.env.PLEDGE_DEFAULT_WIDGET_ID ?? null,
  },
};

const body = JSON.stringify(payload);
const signature = crypto
  .createHmac("sha256", secret)
  .update(body)
  .digest("hex");

console.log(`POST ${targetUrl}`);
console.log(`  event:        ${eventType}`);
console.log(`  submission:   ${submissionId}`);
console.log(`  amount:       $${(amountCents / 100).toFixed(2)} (${amountCents} cents)`);
console.log(`  pledge_event: ${eventId}`);
console.log(`  signature:    sha256=${signature.slice(0, 16)}…`);

const res = await fetch(targetUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Pledgeling-Signature": `sha256=${signature}`,
  },
  body,
});

const text = await res.text();
console.log(`\n← ${res.status} ${res.statusText}`);
console.log(text);
