// scripts/seed-fake-pets.mjs
//
// Seeds a handful of approved pet submissions + fake vote_transactions so
// you can poke at /vote, /admin, and /admin/leaderboard without going
// through the real entry/donation flow.
//
// Usage:
//   node scripts/seed-fake-pets.mjs                 # uses first admin user
//   node scripts/seed-fake-pets.mjs you@email.com   # attaches pets to that user
//   node scripts/seed-fake-pets.mjs --clean         # wipe previous seeds, then re-seed
//   node scripts/seed-fake-pets.mjs you@email.com --clean
//
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Safe to re-run: existing seeded rows are upserted by deterministic ID.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

// ---------- env loader (no dotenv dep) ----------
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    // ignore - rely on shell env
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_BUCKET = process.env.SUPABASE_BUCKET_PUBLIC ?? "pet-public";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const emailArg = args.find((a) => !a.startsWith("--"));

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- find target user ----------
async function findUserId() {
  // Try the email arg first.
  if (emailArg) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase());
    if (u) return u.id;
    console.error(`No auth user found with email "${emailArg}". Available users:`);
    for (const x of data.users) console.error(`  - ${x.email} (${x.id})`);
    process.exit(1);
  }
  // Otherwise prefer an admin profile.
  const { data: profileAdmins } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("role", "admin")
    .limit(1);
  if (profileAdmins && profileAdmins.length) return profileAdmins[0].id;

  // Fallback: any user.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;
  if (!data.users.length) {
    console.error("No auth users exist yet. Sign in once at /login, then re-run.");
    process.exit(1);
  }
  return data.users[0].id;
}

// ---------- fake pets ----------
const PETS = [
  { name: "Biscuit",  owner: "Jane Doe",     votes: 47, amountCents: 4700, blurb: "Goofball golden." },
  { name: "Mochi",    owner: "Kai Tanaka",   votes: 33, amountCents: 3300, blurb: "Tiny shiba, big drama." },
  { name: "Ollie",    owner: "Maria Lopez",  votes: 21, amountCents: 2100, blurb: "Will trade tricks for treats." },
  { name: "Pepper",   owner: "Sam Carter",   votes: 12, amountCents: 1200, blurb: "Black-and-white lab mix." },
  { name: "Waffles",  owner: "Priya Shah",   votes:  6, amountCents:  600, blurb: "Corgi with opinions." },
];

// Deterministic UUIDs so re-running upserts cleanly.
function seededUUID(seed) {
  // not a real UUIDv5; just deterministic-ish hex prefixed with marker.
  const hex = Buffer.from("seed:" + seed).toString("hex").padEnd(32, "0").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function fetchDogImage() {
  // dog.ceo returns a random dog jpg.
  const res = await fetch("https://dog.ceo/api/breeds/image/random");
  const json = await res.json();
  const imgRes = await fetch(json.message);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  // Force jpeg content-type; dog.ceo serves jpgs.
  return { buf, contentType: "image/jpeg", ext: "jpg" };
}

async function uploadImage(submissionId) {
  const { buf, contentType, ext } = await fetchDogImage();
  const path = `${submissionId}.${ext}`;
  const { error } = await admin.storage
    .from(PUBLIC_BUCKET)
    .upload(path, buf, { contentType, upsert: true });
  if (error) throw new Error(`upload failed for ${path}: ${error.message}`);
  return path;
}

async function cleanPrevious() {
  console.log("Cleaning previous seed data…");
  // Find seed pets by deterministic ids
  const ids = PETS.map((p) => seededUUID(p.name));
  await admin.from("vote_transactions").delete().in("pet_submission_id", ids);
  // Best-effort delete storage objects
  const paths = PETS.map((p) => `${seededUUID(p.name)}.jpg`);
  await admin.storage.from(PUBLIC_BUCKET).remove(paths).catch(() => {});
  await admin.from("pet_submissions").delete().in("id", ids);
}

async function main() {
  const userId = await findUserId();
  console.log(`Attaching seed pets to user_id=${userId}`);

  if (clean) await cleanPrevious();

  for (const pet of PETS) {
    const submissionId = seededUUID(pet.name);
    console.log(`→ ${pet.name} (${submissionId})`);

    let publicPath;
    try {
      publicPath = await uploadImage(submissionId);
    } catch (e) {
      console.error(`  image upload failed: ${e.message}`);
      continue;
    }

    const { error: upsertErr } = await admin.from("pet_submissions").upsert(
      {
        id: submissionId,
        user_id: userId,
        owner_name: pet.owner,
        owner_email: `${pet.name.toLowerCase()}@seed.test`,
        owner_phone: null,
        pet_name: pet.name,
        image_path: `seed/${submissionId}.jpg`, // placeholder; private bucket not used
        public_image_path: publicPath,
        consent_public_display: true,
        acknowledged_nonrefundable: true,
        status: "approved",
        entry_donation_confirmed: true,
        approved_at: new Date().toISOString(),
        givebutter_member_url: null,
      },
      { onConflict: "id" },
    );
    if (upsertErr) {
      console.error(`  pet_submissions upsert failed: ${upsertErr.message}`);
      continue;
    }

    // Replace any existing seeded vote rows for this pet, then insert one
    // entry-donation row plus a "manual" boost so totals match `votes`.
    await admin.from("vote_transactions").delete().eq("pet_submission_id", submissionId);

    const entryId = `manual:seed-entry-${submissionId}`;
    const voteId = `manual:seed-votes-${submissionId}`;

    const { error: e1 } = await admin.from("vote_transactions").insert([
      {
        pet_submission_id: submissionId,
        givebutter_transaction_id: entryId,
        kind: "entry",
        donor_name: pet.owner,
        donor_email: `${pet.name.toLowerCase()}@seed.test`,
        amount_cents: 1000,
        votes: 10,
        note: "seed: $10 entry donation",
      },
      {
        pet_submission_id: submissionId,
        givebutter_transaction_id: voteId,
        kind: "manual",
        donor_name: "Seed Donor",
        donor_email: "seed@seed.test",
        amount_cents: Math.max(0, pet.amountCents - 1000),
        votes: Math.max(0, pet.votes - 10),
        note: "seed: fake votes",
      },
    ]);
    if (e1) console.error(`  vote_transactions insert failed: ${e1.message}`);
  }

  // Quick summary
  const { data: lb } = await admin
    .from("pet_leaderboard")
    .select("pet_name, total_votes, total_amount_cents");
  console.log("\nLeaderboard:");
  for (const row of lb ?? []) {
    console.log(
      `  ${row.pet_name.padEnd(10)} ${String(row.total_votes).padStart(4)} votes  $${(row.total_amount_cents / 100).toFixed(2)}`,
    );
  }
  console.log("\nDone. Visit /vote and /admin/leaderboard.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
