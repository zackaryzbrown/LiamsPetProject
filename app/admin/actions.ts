"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function pathExt(path: string): string {
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

// =====================================================================
// Approve a submission
// Copies the photo from pet-uploads → pet-public and flips status to
// 'approved'. Idempotent: re-running just refreshes public_image_path.
// =====================================================================
export async function approveSubmission(submissionId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: row, error: fetchErr } = await admin
    .from("pet_submissions")
    .select("id, image_path, public_image_path")
    .eq("id", submissionId)
    .maybeSingle();
  if (fetchErr || !row) return { ok: false, error: "Submission not found." };
  if (!row.image_path || row.image_path === "pending") {
    return { ok: false, error: "This submission has no photo uploaded yet." };
  }

  // Download the private file, then upload to the public bucket. We use
  // download+upload (instead of `copy`) so that the public bucket name is
  // path-flat (no user_id prefix), which is the convention voters see.
  const dl = await admin.storage.from(env.SUPABASE_BUCKET_UPLOADS).download(row.image_path);
  if (dl.error || !dl.data) {
    return { ok: false, error: `Could not read source photo: ${dl.error?.message ?? "unknown"}` };
  }
  const ext = pathExt(row.image_path);
  const publicPath = `${submissionId}.${ext}`;
  const buffer = new Uint8Array(await dl.data.arrayBuffer());
  const up = await admin.storage
    .from(env.SUPABASE_BUCKET_PUBLIC)
    .upload(publicPath, buffer, { contentType: dl.data.type, upsert: true });
  if (up.error) {
    return { ok: false, error: `Could not publish photo: ${up.error.message}` };
  }

  const { error: updErr } = await admin
    .from("pet_submissions")
    .update({
      status: "approved",
      public_image_path: publicPath,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    })
    .eq("id", submissionId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath("/vote");
  return { ok: true, message: "Approved." };
}

// =====================================================================
// Reject a submission
// =====================================================================
const RejectSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().trim().min(1, "Provide a reason.").max(500),
});

export async function rejectSubmission(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = RejectSchema.safeParse({
    submissionId: formData.get("submissionId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = createAdminClient();

  // Remove from public bucket if previously approved.
  const { data: row } = await admin
    .from("pet_submissions")
    .select("public_image_path")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();
  if (row?.public_image_path) {
    await admin.storage.from(env.SUPABASE_BUCKET_PUBLIC).remove([row.public_image_path]);
  }

  const { error } = await admin
    .from("pet_submissions")
    .update({
      status: "rejected",
      rejection_reason: parsed.data.reason,
      rejected_at: new Date().toISOString(),
      approved_at: null,
      public_image_path: null,
    })
    .eq("id", parsed.data.submissionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${parsed.data.submissionId}`);
  revalidatePath("/vote");
  return { ok: true, message: "Rejected." };
}

// =====================================================================
// Remove submission entirely (and its uploaded files)
// =====================================================================
export async function deleteSubmission(submissionId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("pet_submissions")
    .select("image_path, public_image_path")
    .eq("id", submissionId)
    .maybeSingle();

  // Best-effort file cleanup; continue even if storage removes fail.
  if (row?.image_path && row.image_path !== "pending") {
    await admin.storage.from(env.SUPABASE_BUCKET_UPLOADS).remove([row.image_path]);
  }
  if (row?.public_image_path) {
    await admin.storage.from(env.SUPABASE_BUCKET_PUBLIC).remove([row.public_image_path]);
  }

  const { error } = await admin.from("pet_submissions").delete().eq("id", submissionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/submissions");
  revalidatePath("/vote");
  return { ok: true, message: "Removed." };
}

// =====================================================================
// Edit Givebutter links
// =====================================================================
const LinksSchema = z.object({
  submissionId: z.string().uuid(),
  givebutterMemberUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  givebutterMemberId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function updateGivebutterLinks(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = LinksSchema.safeParse({
    submissionId: formData.get("submissionId"),
    givebutterMemberUrl: formData.get("givebutterMemberUrl") ?? "",
    givebutterMemberId: formData.get("givebutterMemberId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("pet_submissions")
    .update({
      givebutter_member_url: parsed.data.givebutterMemberUrl ?? null,
      givebutter_member_id: parsed.data.givebutterMemberId ?? null,
    })
    .eq("id", parsed.data.submissionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/submissions/${parsed.data.submissionId}`);
  revalidatePath("/vote");
  return { ok: true, message: "Saved." };
}

// =====================================================================
// Manual vote adjustment
// Inserts a row in vote_transactions (the single source of truth for
// votes). Use a positive amount/votes to add, negative to subtract.
// =====================================================================
const ManualVoteSchema = z.object({
  submissionId: z.string().uuid(),
  amountDollars: z.coerce.number().finite(),
  votes: z.coerce.number().int(),
  note: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
});

export async function manualVoteAdjustment(formData: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = ManualVoteSchema.safeParse({
    submissionId: formData.get("submissionId"),
    amountDollars: formData.get("amountDollars"),
    votes: formData.get("votes"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.amountDollars === 0 && parsed.data.votes === 0) {
    return { ok: false, error: "Adjustment must change either amount or votes." };
  }

  const admin = createAdminClient();
  const amountCents = Math.round(parsed.data.amountDollars * 100);
  const txnId = `manual:${crypto.randomUUID()}`;

  const { error } = await admin.from("vote_transactions").insert({
    pet_submission_id: parsed.data.submissionId,
    givebutter_transaction_id: txnId,
    kind: "manual",
    amount_cents: amountCents,
    votes: parsed.data.votes,
    created_by_admin: ctx.userId,
    note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/submissions/${parsed.data.submissionId}`);
  revalidatePath("/admin/leaderboard");
  revalidatePath("/vote");
  return { ok: true, message: "Adjustment recorded." };
}

// =====================================================================
// Contest settings
// =====================================================================
const SettingsSchema = z.object({
  contestOpen: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean()])
    .transform((v) => v === true || v === "on" || v === "true"),
  submissionDeadline: z.string().min(1),
  votingDeadline: z.string().min(1),
  goalAmountDollars: z.coerce.number().nonnegative().max(10_000_000),
});

export async function updateContestSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = SettingsSchema.safeParse({
    contestOpen: formData.get("contestOpen") ?? "",
    submissionDeadline: formData.get("submissionDeadline"),
    votingDeadline: formData.get("votingDeadline"),
    goalAmountDollars: formData.get("goalAmountDollars"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const sub = new Date(parsed.data.submissionDeadline);
  const vote = new Date(parsed.data.votingDeadline);
  if (Number.isNaN(sub.getTime()) || Number.isNaN(vote.getTime())) {
    return { ok: false, error: "Invalid date format." };
  }
  if (vote.getTime() < sub.getTime()) {
    return { ok: false, error: "Voting deadline must be on/after the submission deadline." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("contest_settings")
    .update({
      contest_open: parsed.data.contestOpen,
      submission_deadline: sub.toISOString(),
      voting_deadline: vote.toISOString(),
      goal_amount_cents: Math.round(parsed.data.goalAmountDollars * 100),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/vote");
  return { ok: true, message: "Saved." };
}

// =====================================================================
// Generate a short-lived signed URL for a private upload (admin-only)
// =====================================================================
export async function getSignedUploadUrl(
  imagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(env.SUPABASE_BUCKET_UPLOADS)
    .createSignedUrl(imagePath, 60 * 10);
  if (error || !data) return { ok: false, error: error?.message ?? "Failed to sign URL." };
  return { ok: true, url: data.signedUrl };
}
