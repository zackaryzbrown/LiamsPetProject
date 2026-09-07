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

const normalizePledgeDonationUrl = (
  value: string | undefined,
): string | undefined => {
  if (!value) return value;
  try {
    const u = new URL(value);
    if (u.hostname.toLowerCase() === "staging.pledge.to") {
      u.hostname = "www.pledge.to";
      u.port = "";
      return u.toString();
    }
    return value;
  } catch {
    return value;
  }
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
    return process.env.NEXT_PUBLIC_SITE_URL ?? "https://cutepetshowdown.com";
  },
  get NEXT_PUBLIC_CONTACT_EMAIL() {
    return process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "smittyliam@gmail.com";
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

  // -------------------------------------------------------------------
  // Pledge.to — the ONLY donation platform for this project.
  //
  // PLEDGE_API_KEY:               server-only API key for outbound calls.
  // PLEDGE_WEBHOOK_SECRET:        HMAC-SHA256 secret used to verify
  //                               inbound webhooks. Falls back to the
  //                               API key when not configured — confirm
  //                               with your Pledge dashboard whether the
  //                               platform sends a separate signing
  //                               secret or signs with the API key.
  // PLEDGE_API_BASE_URL:          production REST base.
  // PLEDGE_SANDBOX_API_BASE_URL:  sandbox base used for dev/test.
  // PLEDGE_DEFAULT_DONATION_URL:  fallback hosted-checkout URL for the
  //                               $10 entry donation when a per-pet URL
  //                               has not been configured yet.
  // PLEDGE_DEFAULT_WIDGET_ID /
  // PLEDGE_DEFAULT_CAMPAIGN_ID:   defaults when admin has not assigned
  //                               per-pet values.
  // PLEDGE_SUBMISSION_FIELD_KEY:  query-param / custom-field key we
  //                               append to the donation URL so the
  //                               webhook can map a donation back to
  //                               the pet.
  // PLEDGE_INTENT_SIGNING_SECRET: optional HMAC secret used for the
  //                               short-lived vote-intent tokens we
  //                               append to secure donation-start links.
  // -------------------------------------------------------------------
  get PLEDGE_API_KEY() {
    return optional("PLEDGE_API_KEY");
  },
  get PLEDGE_WEBHOOK_SECRET() {
    return optional("PLEDGE_WEBHOOK_SECRET") ?? optional("PLEDGE_API_KEY");
  },
  get PLEDGE_API_BASE_URL() {
    return process.env.PLEDGE_API_BASE_URL ?? "https://api.pledge.to/v1";
  },
  get PLEDGE_SANDBOX_API_BASE_URL() {
    return (
      process.env.PLEDGE_SANDBOX_API_BASE_URL ??
      "https://api.sandbox.pledge.to/v1"
    );
  },
  get PLEDGE_DEFAULT_DONATION_URL() {
    return normalizePledgeDonationUrl(optional("PLEDGE_DEFAULT_DONATION_URL"));
  },
  get PLEDGE_DEFAULT_WIDGET_ID() {
    return optional("PLEDGE_DEFAULT_WIDGET_ID");
  },
  get PLEDGE_DEFAULT_CAMPAIGN_ID() {
    return optional("PLEDGE_DEFAULT_CAMPAIGN_ID");
  },
  get PLEDGE_SUBMISSION_FIELD_KEY() {
    return process.env.PLEDGE_SUBMISSION_FIELD_KEY ?? "submission_id";
  },
  get PLEDGE_INTENT_SIGNING_SECRET() {
    return optional("PLEDGE_INTENT_SIGNING_SECRET");
  },
};
