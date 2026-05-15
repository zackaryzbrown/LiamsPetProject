"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// =====================================================================
// Contact form server action.
//
// Validates the input, stores it in public.contact_messages via the
// service-role client, and returns a discriminated result the client
// form can render. A hidden honeypot field ("website") gives us cheap
// bot rejection without needing CAPTCHA.
// =====================================================================

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Please enter your email")
    .email("Enter a valid email")
    .max(254),
  subject: z
    .string()
    .trim()
    .max(180)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message is too long (5000 chars max)"),
  // Honeypot — humans leave this blank. Bots fill every field.
  website: z
    .string()
    .max(0, "Spam check failed")
    .optional()
    .transform(() => ""),
});

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitContactMessage(
  _prev: ContactResult | null,
  formData: FormData,
): Promise<ContactResult> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") ?? "",
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  };

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  // Silently swallow honeypot hits — looks like success to the bot.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { ok: true };
  }

  const h = await headers();
  const userAgent = h.get("user-agent");
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("contact_messages").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject ?? null,
      message: parsed.data.message,
      user_agent: userAgent ?? null,
      ip,
    });
    if (error) {
      console.error("[contact] insert failed", error);
      return {
        ok: false,
        error: "Something went wrong on our end. Please try again in a moment.",
      };
    }
  } catch (err) {
    console.error("[contact] unexpected error", err);
    return {
      ok: false,
      error: "Something went wrong on our end. Please try again in a moment.",
    };
  }

  return { ok: true };
}
