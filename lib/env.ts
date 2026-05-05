// Lazy server-only env access. Each property is resolved on first read so
// that the module can be imported during `next build` page-data collection
// (when env vars may not be loaded), but throws clearly when a missing
// required value is actually accessed at runtime.

const required = (name: string): string => {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
  return value;
};

const optional = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
};

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const env = {
  // Public
  get NEXT_PUBLIC_SUPABASE_URL() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get NEXT_PUBLIC_SITE_URL() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
  get NEXT_PUBLIC_CONTACT_EMAIL() {
    return process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@example.org";
  },

  // Server-only
  get SUPABASE_SERVICE_ROLE_KEY() {
    return optional("SUPABASE_SERVICE_ROLE_KEY");
  },
  get SUPABASE_BUCKET_UPLOADS() {
    return process.env.SUPABASE_BUCKET_UPLOADS ?? "pet-uploads";
  },
  get SUPABASE_BUCKET_PUBLIC() {
    return process.env.SUPABASE_BUCKET_PUBLIC ?? "pet-public";
  },
  get ADMIN_EMAILS() {
    return adminEmails();
  },

  // Givebutter — optional during early phases; checked when used.
  get GIVEBUTTER_ENTRY_CHECKOUT_URL() {
    return optional("GIVEBUTTER_ENTRY_CHECKOUT_URL");
  },
  get GIVEBUTTER_SUBMISSION_FIELD_KEY() {
    return process.env.GIVEBUTTER_SUBMISSION_FIELD_KEY ?? "submission_id";
  },
  get GIVEBUTTER_WEBHOOK_SECRET() {
    return optional("GIVEBUTTER_WEBHOOK_SECRET");
  },
  get GIVEBUTTER_API_KEY() {
    return optional("GIVEBUTTER_API_KEY");
  },
};
