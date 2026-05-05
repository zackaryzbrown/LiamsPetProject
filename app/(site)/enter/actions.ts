"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { PetSubmissionSchema, validateImage } from "@/lib/validation";

export type SubmissionResult =
  | { ok: true; submissionId: string; donationUrl: string | null }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitPet(formData: FormData): Promise<SubmissionResult> {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to submit a pet." };

  // 2. Validate text fields
  const parsed = PetSubmissionSchema.safeParse({
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPhone: formData.get("ownerPhone") || undefined,
    petName: formData.get("petName"),
    consentPublic: formData.get("consentPublic"),
    acknowledgedNonrefundable: formData.get("acknowledgedNonrefundable"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  // 3. Validate image
  const photo = formData.get("photo");
  const imageCheck = validateImage(photo instanceof File ? photo : null);
  if (!imageCheck.ok) {
    return { ok: false, error: imageCheck.error, fieldErrors: { photo: imageCheck.error } };
  }

  // 4. Insert pet_submissions row (RLS allows owner to insert with locked
  //    initial state). We do this BEFORE upload so we can use the row id
  //    in the storage path.
  const insert = await supabase
    .from("pet_submissions")
    .insert({
      user_id: user.id,
      owner_name: parsed.data.ownerName,
      owner_email: parsed.data.ownerEmail,
      owner_phone: parsed.data.ownerPhone ?? null,
      pet_name: parsed.data.petName,
      image_path: "pending", // overwritten after upload
      consent_public_display: true,
      acknowledged_nonrefundable: true,
      status: "pending_payment",
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    return { ok: false, error: insert.error?.message ?? "Could not save your submission." };
  }
  const submissionId = insert.data.id as string;

  // 5. Upload to private bucket via the service-role client (storage
  //    policies restrict authenticated writes; server validates path).
  const path = `${user.id}/${submissionId}.${imageCheck.ext}`;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Server is not fully configured (missing service role)." };
  }

  const arrayBuffer = await imageCheck.file.arrayBuffer();
  const upload = await admin.storage
    .from(env.SUPABASE_BUCKET_UPLOADS)
    .upload(path, new Uint8Array(arrayBuffer), {
      contentType: imageCheck.file.type,
      upsert: true,
    });
  if (upload.error) {
    // Best-effort cleanup so we don't leave orphan rows.
    await admin.from("pet_submissions").delete().eq("id", submissionId);
    return { ok: false, error: `Photo upload failed: ${upload.error.message}` };
  }

  // 6. Persist final image_path
  const update = await admin
    .from("pet_submissions")
    .update({ image_path: path })
    .eq("id", submissionId);
  if (update.error) {
    return { ok: false, error: "Saved photo but couldn't link it. Contact support." };
  }

  revalidatePath("/admin/submissions");

  // 7. Build entry-donation URL (returns null if Givebutter not yet configured)
  const { buildEntryDonationUrl } = await import("@/lib/givebutter");
  return { ok: true, submissionId, donationUrl: buildEntryDonationUrl(submissionId) };
}
