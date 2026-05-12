import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Navbar } from "./Navbar";

// Server wrapper that decides whether to show the Admin link in the navbar.
// The link itself is just a UI affordance - every /admin route still calls
// requireAdmin() server-side, so hiding it here is purely cosmetic.
export async function NavbarServer() {
  // Render a safe signed-out navbar if Supabase isn't configured or the
  // request fails for any reason - the navbar shouldn't be able to crash
  // the entire layout.
  const donateUrl = env.PLEDGE_DEFAULT_DONATION_URL ?? null;
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return <Navbar isAdmin={false} isSignedIn={false} donateUrl={donateUrl} />;
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let isAdmin = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }
    return (
      <Navbar
        isAdmin={isAdmin}
        isSignedIn={!!user}
        donateUrl={donateUrl}
      />
    );
  } catch {
    return <Navbar isAdmin={false} isSignedIn={false} donateUrl={donateUrl} />;
  }
}
