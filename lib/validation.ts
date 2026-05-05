import { z } from "zod";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const phoneRe = /^[+()\-\s\d]{7,20}$/;

// Common base + transforms. We accept FormData on the server, so we keep the
// schema string-first and refine the file separately.
export const PetSubmissionSchema = z.object({
  ownerName: z.string().trim().min(1, "Owner name is required").max(120),
  ownerEmail: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  ownerPhone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || phoneRe.test(v), "Enter a valid phone number"),
  petName: z.string().trim().min(1, "Pet name is required").max(80),
  consentPublic: z
    .union([z.literal("on"), z.literal("true"), z.literal(true)])
    .transform(() => true),
  acknowledgedNonrefundable: z
    .union([z.literal("on"), z.literal("true"), z.literal(true)])
    .transform(() => true),
});

export type PetSubmissionInput = z.infer<typeof PetSubmissionSchema>;

export function validateImage(file: File | null | undefined):
  | { ok: true; file: File; ext: "jpg" | "png" | "webp" }
  | { ok: false; error: string } {
  if (!file || file.size === 0) return { ok: false, error: "Pet photo is required" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Photo must be 5MB or smaller" };
  const type = file.type as (typeof ALLOWED_IMAGE_TYPES)[number];
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    return { ok: false, error: "Photo must be a JPG, PNG, or WEBP image" };
  }
  const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
  return { ok: true, file, ext };
}
