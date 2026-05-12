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
// Approve a submission: copies the private upload to the public bucket
// at <id>.<ext> and flips status to approved. The leaderboard reads
// directly from pet_submissions where status='approved'.
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

  const dl = await admin.storage
    .from(env.SUPABASE_BUCKET_UPLOADS)
    .download(row.image_path);
  if (dl.error || !dl.data) {
    return {
      ok: false,
      error: `Could not read source photo: ${dl.error?.message ?? "unknown"}`,
    };
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
// Manual confirmation of entry donation (cash/check or dev path).
// Webhook normally handles this, but admins can flip status when the
// entry was paid outside Pledge.to.
// =====================================================================
export async function confirmEntryDonation(submissionId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: row, error: fetchErr } = await admin
    .from("pet_submissions")
    .select("id, status")
    .eq("id", submissionId)
    .maybeSingle();
  if (fetchErr || !row) return { ok: false, error: "Submission not found." };

  const updates: {
    entry_donation_confirmed: boolean;
    status?: "pending_review";
  } = { entry_donation_confirmed: true };
  if (row.status === "pending_payment") updates.status = "pending_review";

  const { error: updErr } = await admin
    .from("pet_submissions")
    .update(updates)
    .eq("id", submissionId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  return { ok: true, message: "Entry donation confirmed." };
}

// =====================================================================
// Reject a submission and remove any published photo.
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

  const { data: row } = await admin
    .from("pet_submissions")
    .select("public_image_path")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();
  if (row?.public_image_path) {
    await admin.storage
      .from(env.SUPABASE_BUCKET_PUBLIC)
      .remove([row.public_image_path]);
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
// Delete a submission entirely (clears both buckets).
// =====================================================================
export async function deleteSubmission(submissionId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("pet_submissions")
    .select("image_path, public_image_path")
    .eq("id", submissionId)
    .maybeSingle();

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
// Edit Pledge.to links / mapping for a pet.
//
// Admins paste in any combination of donation URL, widget id, campaign
// id, and mapping key. All four are nullable. The webhook can map a
// donation back via custom field, mapping_key, widget_id, or
// campaign_id (priority order in app/api/webhooks/pledge/route.ts).
// =====================================================================
const PledgeLinksSchema = z.object({
  submissionId: z.string().uuid(),
  pledgeDonationUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine(
      (v) => v === undefined || /^https?:\/\//i.test(v),
      "Must be an http(s) URL",
    ),
  pledgeWidgetId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  pledgeCampaignId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  pledgeMappingKey: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export async function updatePledgeLinks(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = PledgeLinksSchema.safeParse({
    submissionId: formData.get("submissionId"),
    pledgeDonationUrl: formData.get("pledgeDonationUrl") ?? "",
    pledgeWidgetId: formData.get("pledgeWidgetId") ?? "",
    pledgeCampaignId: formData.get("pledgeCampaignId") ?? "",
    pledgeMappingKey: formData.get("pledgeMappingKey") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("pet_submissions")
    .update({
      pledge_donation_url: parsed.data.pledgeDonationUrl ?? null,
      pledge_widget_id: parsed.data.pledgeWidgetId ?? null,
      pledge_campaign_id: parsed.data.pledgeCampaignId ?? null,
      pledge_mapping_key: parsed.data.pledgeMappingKey ?? null,
    })
    .eq("id", parsed.data.submissionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/submissions/${parsed.data.submissionId}`);
  revalidatePath("/vote");
  return { ok: true, message: "Saved." };
}

// =====================================================================
// Manual vote adjustment — every change is audit-logged via the
// `apply_manual_vote_adjustment` database function. $1 = 1 vote.
// Positive amounts add votes; negative amounts subtract.
//
// This is the ONLY path for changing vote totals outside the Pledge.to
// webhook. Vote counts are never directly editable.
// =====================================================================
const ManualVoteSchema = z.object({
  submissionId: z.string().uuid(),
  amountDollars: z.coerce.number().finite(),
  reason: z.string().trim().min(1, "Reason is required.").max(500),
});

export async function manualVoteAdjustment(formData: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = ManualVoteSchema.safeParse({
    submissionId: formData.get("submissionId"),
    amountDollars: formData.get("amountDollars"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.amountDollars === 0) {
    return { ok: false, error: "Enter a non-zero amount." };
  }
  const cents = Math.round(parsed.data.amountDollars * 100);

  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_manual_vote_adjustment", {
    p_pet_id: parsed.data.submissionId,
    p_admin_id: ctx.userId,
    p_cents_delta: cents,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/submissions/${parsed.data.submissionId}`);
  revalidatePath("/admin/leaderboard");
  revalidatePath("/vote");
  return {
    ok: true,
    message: `Recorded adjustment of $${parsed.data.amountDollars.toFixed(2)}.`,
  };
}

// =====================================================================
// Contest settings.
// =====================================================================
const truthyFlag = z
  .union([
    z.literal("on"),
    z.literal("true"),
    z.literal("false"),
    z.literal(""),
    z.boolean(),
  ])
  .transform((v) => v === true || v === "on" || v === "true");

const SettingsSchema = z.object({
  submissionsOpen: truthyFlag,
  votingOpen: truthyFlag,
  submissionDeadline: z.string().min(1),
  votingDeadline: z.string().min(1),
  goalAmountDollars: z.coerce.number().nonnegative().max(10_000_000),
});

export async function updateContestSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = SettingsSchema.safeParse({
    submissionsOpen: formData.get("submissionsOpen") ?? "",
    votingOpen: formData.get("votingOpen") ?? "",
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
      contest_open: parsed.data.submissionsOpen || parsed.data.votingOpen,
      submissions_open: parsed.data.submissionsOpen,
      voting_open: parsed.data.votingOpen,
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
