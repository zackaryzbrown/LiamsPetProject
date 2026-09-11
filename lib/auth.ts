import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type AdminContext = {
  userId: string;
  email: string;
};

// Server-only admin gate. Use in admin layouts, pages, and at the top of
// every admin server action - never trust the client. Redirects to /login
// if not signed in, and to / if signed in but not an admin.
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const email = user.email?.toLowerCase();
  if (
    email &&
    env.ADMIN_EMAILS.includes(email) &&
    env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      await createAdminClient().rpc("promote_admin_by_email", {
        p_email: email,
      });
    } catch {
      // The role check below remains the authorization source of truth.
    }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== "admin") {
    redirect("/?notice=admin_only");
  }

  return { userId: user.id, email: profile.email };
}
