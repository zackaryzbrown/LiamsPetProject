"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Derive the absolute URL of THIS request so OAuth redirects always come
// back to the same domain the user is on (production, preview, or local).
// Falls back to NEXT_PUBLIC_SITE_URL only if headers are unavailable.
async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? null;
  const proto =
    h.get("x-forwarded-proto") ??
    (host && host.startsWith("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://liams-pet-project-zacksbrodevs-projects.vercel.app"
  );
}

export async function signInWithGoogle(next?: string) {
  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const redirectTo = new URL("/auth/callback", origin);
  if (next) redirectTo.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`,
    );
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type EmailSignInResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export async function signInWithEmail(
  _prev: EmailSignInResult | null,
  formData: FormData,
): Promise<EmailSignInResult> {
  const rawEmail = (formData.get("email") ?? "")
    .toString()
    .trim()
    .toLowerCase();
  const next = (formData.get("next") ?? "/").toString();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const redirectTo = new URL("/auth/callback", origin);
  if (next) redirectTo.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email: rawEmail,
    options: {
      emailRedirectTo: redirectTo.toString(),
      shouldCreateUser: true,
    },
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, email: rawEmail };
}
