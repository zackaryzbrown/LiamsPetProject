import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refreshes the Supabase auth cookie on every request. Required for SSR auth.
export async function middleware(request: NextRequest) {
  // Expose the pathname to server components so layouts can branch on
  // the current route (e.g. to clear unread badges on /admin/messages).
  // Setting it on the *request* headers (not response) is what makes it
  // readable via next/headers in server components.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // No-op when env is missing (e.g., fresh clone before .env.local is set).
  // Pages that actually need Supabase will error clearly at their own call
  // sites; we don't want middleware to crash every route.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() forces a refresh if the access token has expired.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Run on everything except static assets, Next internals, and webhook
  // routes (which authenticate via signature, not Supabase cookies).
  matcher: [
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)",
  ],
};
