import { createClient } from "@/lib/supabase/server";
import { Navbar } from "./Navbar";

// Server wrapper that decides whether to show the Admin link in the navbar.
// The link itself is just a UI affordance - every /admin route still calls
// requireAdmin() server-side, so hiding it here is purely cosmetic.
export async function NavbarServer() {
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
  return <Navbar isAdmin={isAdmin} isSignedIn={!!user} />;
}
