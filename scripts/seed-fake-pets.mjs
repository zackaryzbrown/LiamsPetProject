#!/usr/bin/env node
// scripts/seed-fake-pets.mjs
//
// Seeds approved pets + matching pledge_donations rows for local QA.
//
// Usage:
//   node scripts/seed-fake-pets.mjs
//   node scripts/seed-fake-pets.mjs you@example.com
//   node scripts/seed-fake-pets.mjs --clean
//   node scripts/seed-fake-pets.mjs you@example.com --clean
//
// Requires:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    // Fall back to shell env.
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_BUCKET = process.env.SUPABASE_BUCKET_PUBLIC ?? "pet-public";
const DEFAULT_DONATION_URL = process.env.PLEDGE_DEFAULT_DONATION_URL ?? null;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const emailArg = args.find((a) => !a.startsWith("--"));

const PETS = [
  { name: "Biscuit", owner: "Jane Doe", votes: 47 },
  { name: "Mochi", owner: "Kai Tanaka", votes: 33 },
  { name: "Ollie", owner: "Maria Lopez", votes: 21 },
  { name: "Pepper", owner: "Sam Carter", votes: 12 },
  { name: "Waffles", owner: "Priya Shah", votes: 6 },
];

// 1x1 transparent PNG.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YwV7vEAAAAASUVORK5CYII=",
  "base64",
);

function seededUUID(seed) {
  const hex = Buffer.from(`seed:${seed}`)
    .toString("hex")
    .padEnd(32, "0")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function seedRefs(submissionId) {
  return {
    eventId: `seed_evt_${submissionId.replaceAll("-", "")}`,
    txId: `seed_tx_${submissionId.replaceAll("-", "")}`,
  };
}

async function findUserId() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  if (!data.users.length) {
    console.error("No auth users exist yet. Sign in once at /login, then re-run.");
    process.exit(1);
  }

  if (emailArg) {
    const user = data.users.find(
      (u) => u.email?.toLowerCase() === emailArg.toLowerCase(),
    );
    if (!user) {
      console.error(`No auth user found with email "${emailArg}".`);
      process.exit(1);
    }
    return user.id;
  }

  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1);
  if (admins?.length) return admins[0].id;
  return data.users[0].id;
}

async function cleanPreviousSeeds() {
  const ids = PETS.map((p) => seededUUID(p.name));
  const eventIds = ids.map((id) => seedRefs(id).eventId);
  const paths = ids.map((id) => `${id}.png`);

  await admin
    .from("pledge_webhook_events")
    .delete()
    .in("pledge_event_id", eventIds);
  await admin
    .from("pledge_donations")
    .delete()
    .in("pledge_event_id", eventIds);
  await admin.from("pet_submissions").delete().in("id", ids);
  await admin.storage.from(PUBLIC_BUCKET).remove(paths).catch(() => {});
}

async function upsertSeedPet(userId, pet) {
  const submissionId = seededUUID(pet.name);
  const amountCents = pet.votes * 100;
  const email = `${pet.name.toLowerCase()}@seed.test`;
  const publicPath = `${submissionId}.png`;
  const refs = seedRefs(submissionId);

  const uploaded = await admin.storage
    .from(PUBLIC_BUCKET)
    .upload(publicPath, ONE_PIXEL_PNG, {
      contentType: "image/png",
      upsert: true,
    });
  if (uploaded.error) throw new Error(uploaded.error.message);

  const petUpsert = await admin.from("pet_submissions").upsert(
    {
      id: submissionId,
      user_id: userId,
      owner_name: pet.owner,
      owner_email: email,
      owner_phone: null,
      pet_name: pet.name,
      image_path: `seed/${submissionId}.png`,
      public_image_path: publicPath,
      consent_public_display: true,
      acknowledged_nonrefundable: true,
      status: "approved",
      entry_donation_confirmed: true,
      total_votes: pet.votes,
      total_donated_cents: amountCents,
      manual_vote_adjustment: 0,
      pledge_donation_url: DEFAULT_DONATION_URL,
      entry_pledge_transaction_id: refs.txId,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    },
    { onConflict: "id" },
  );
  if (petUpsert.error) throw new Error(petUpsert.error.message);

  const donationUpsert = await admin.from("pledge_donations").upsert(
    {
      pet_submission_id: submissionId,
      pledge_event_id: refs.eventId,
      pledge_transaction_id: refs.txId,
      donor_name: pet.owner,
      donor_email: email,
      amount_cents: amountCents,
      tip_cents: 0,
      fee_cents: 0,
      currency: "USD",
      vote_credits: pet.votes,
      donation_type: "vote",
      raw_payload: {
        source: "seed-script",
        pet: pet.name,
        amount_cents: amountCents,
      },
      processed_at: new Date().toISOString(),
    },
    { onConflict: "pledge_event_id" },
  );
  if (donationUpsert.error) throw new Error(donationUpsert.error.message);

  const eventUpsert = await admin.from("pledge_webhook_events").upsert(
    {
      pledge_event_id: refs.eventId,
      event_type: "donation.completed",
      signature_verified: true,
      processing_status: "processed",
      pet_submission_id: submissionId,
      raw_payload: {
        source: "seed-script",
        pet: pet.name,
      },
      raw_headers: {
        source: "seed-script",
      },
      processed_at: new Date().toISOString(),
      error_message: null,
    },
    { onConflict: "pledge_event_id" },
  );
  if (eventUpsert.error) throw new Error(eventUpsert.error.message);

  return { submissionId, amountCents };
}

async function printSummary() {
  const ids = PETS.map((p) => seededUUID(p.name));
  const { data } = await admin
    .from("pet_submissions")
    .select("pet_name, total_votes, total_donated_cents")
    .in("id", ids)
    .order("total_votes", { ascending: false });

  console.log("\nSeeded leaderboard:");
  for (const row of data ?? []) {
    const amount = (row.total_donated_cents / 100).toFixed(2);
    console.log(
      `  ${row.pet_name.padEnd(10)} ${String(row.total_votes).padStart(4)} votes  $${amount}`,
    );
  }
}

async function main() {
  const userId = await findUserId();
  console.log(`Using user_id=${userId}`);

  if (clean) {
    console.log("Cleaning prior seed rows...");
    await cleanPreviousSeeds();
  }

  for (const pet of PETS) {
    process.stdout.write(`Seeding ${pet.name}... `);
    try {
      await upsertSeedPet(userId, pet);
      console.log("ok");
    } catch (error) {
      console.log("failed");
      throw error;
    }
  }

  await printSummary();
  console.log("\nDone. Visit /vote and /admin.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
