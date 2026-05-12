"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { buildEntryDonationUrl } from "@/lib/pledge";
import { PetSubmissionSchema, validateImage } from "@/lib/validation";

export type EnterResult =
  | { ok: true; submissionId: string; donationUrl: string | null }
  | { ok: false; error: string };

// =====================================================================
// Pet entry server action.
//
// Flow:
//   1.  Authenticated user (must be signed in to enter).
//   2.  Validate the form + image server-side.
//   3.  Insert the pet_submissions row with status=pending_payment.
//       The RLS policy `pet_submissions_insert_owner` enforces all
//       Pledge fields are null at insert time.
//   4.  Upload the image to the private bucket at
//       pet-uploads/<user_id>/<submission_id>.<ext>.
//   5.  Update the row with the resolved image_path (we needed the
//       generated UUID first).
//   6.  Build the Pledge.to entry donation URL (tagged with the
//       submission_id custom field) so the form can redirect.
// =====================================================================
export async function enterPet(formData: FormData): Promise<EnterResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in before entering your pet." };
  }

  const parsed = PetSubmissionSchema.safeParse({
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPhone: formData.get("ownerPhone") ?? "",
    petName: formData.get("petName"),
    consentPublic: formData.get("consentPublic") ?? "",
    acknowledgedNonrefundable: formData.get("acknowledgedNonrefundable") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please complete every field.",
    };
  }

  const imageEntry = formData.get("image");
  const file =
    imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;
  const imageCheck = validateImage(file);
  if (!imageCheck.ok) return { ok: false, error: imageCheck.error };

  // Step 1: insert row with a placeholder image_path so we can capture
  // the generated UUID. The placeholder "pending" is filtered out
  // anywhere we read submissions for display.
  const { data: inserted, error: insertErr } = await supabase
    .from("pet_submissions")
    .insert({
      user_id: user.id,
      owner_name: parsed.data.ownerName,
      owner_email: parsed.data.ownerEmail,
      owner_phone: parsed.data.ownerPhone ?? null,
      pet_name: parsed.data.petName,
      image_path: "pending",
      consent_public_display: parsed.data.consentPublic,
      acknowledged_nonrefundable: parsed.data.acknowledgedNonrefundable,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "Could not save your submission." };
  }

  // Step 2: upload image with admin client (RLS-free path).
  const admin = createAdminClient();
  const objectPath = `${user.id}/${inserted.id}.${imageCheck.ext}`;
  const buffer = new Uint8Array(await imageCheck.file.arrayBuffer());
  const up = await admin.storage
    .from(env.SUPABASE_BUCKET_UPLOADS)
    .upload(objectPath, buffer, {
      contentType: imageCheck.file.type,
      upsert: true,
    });
  if (up.error) {
    // Roll back the row so the user can retry cleanly.
    await admin.from("pet_submissions").delete().eq("id", inserted.id);
    return { ok: false, error: `Could not upload photo: ${up.error.message}` };
  }

  // Step 3: backfill image_path.
  const { error: updErr } = await admin
    .from("pet_submissions")
    .update({ image_path: objectPath })
    .eq("id", inserted.id);
  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/admin/submissions");

  // Step 4: Record a donation intent so the webhook can attribute the
  // incoming entry donation back to this pet by donor email — Pledge's
  // hosted donation page drops URL query params, so submission_id /
  // utm_content are not reliably forwarded to the webhook payload.
  await admin.from("donation_intents").insert({
    pet_submission_id: inserted.id,
    user_id: user.id,
    donor_email: parsed.data.ownerEmail,
    intent_type: "entry",
  });

  // Step 5: Pledge.to entry donation URL (still includes submission_id
  // as a belt-and-braces signal in case Pledge ever starts forwarding
  // query params).
  const donationUrl = buildEntryDonationUrl(inserted.id);
  return { ok: true, submissionId: inserted.id, donationUrl };
}
