import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// Handles the OAuth redirect from Google → Supabase → us.
// Exchanges the code for a session and promotes the user to admin if their
// email is in ADMIN_EMAILS. Then redirects back to `next` (default "/").
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message ?? "auth_failed")}`, url.origin),
    );
  }

  // Admin promotion via service-role client (RLS-safe). Idempotent.
  const email = data.user.email?.toLowerCase();
  if (email && env.ADMIN_EMAILS.includes(email) && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      await admin.rpc("promote_admin_by_email", { p_email: email });
    } catch {
      // Non-fatal; user can still sign in as a regular user.
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
