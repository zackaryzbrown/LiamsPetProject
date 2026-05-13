import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PawMark } from "@/components/PawMark";
import { EmailSignInForm } from "./EmailSignInForm";
import { sanitizeNextPath } from "@/lib/safe-next";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Sign-in didn't complete. Please try again.",
  oauth_failed: "Google sign-in failed. Please try again.",
  auth_failed: "We couldn't verify your sign-in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const next = sanitizeNextPath(sp.next, "/enter");
  if (user) redirect(next);

  const error = sp.error ? (ERROR_MESSAGES[sp.error] ?? sp.error) : null;

  return (
    <section className="container py-20 md:py-28 max-w-xl">
      <p className="eyebrow text-royal-700">Sign in</p>
      <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
        Sign in to <span className="italic text-ember-500">enter your pet</span>.
      </h1>
      <p className="mt-4 text-ink-muted">
        We use Google sign-in for pet submitters so we can attach your submission to your
        account. Voters do not need an account.
      </p>

      <Card className="mt-8">
        <CardContent className="p-6 md:p-8 grid gap-4">
          {error && (
            <div className="rounded-xl border-2 border-ember-500 bg-ember-50 p-3 text-sm text-ember-700">
              {error}
            </div>
          )}
          <form action={signInWithGoogle.bind(null, next)}>
            <Button type="submit" variant="ink" size="lg" className="w-full">
              <PawMark size={18} />
              Continue with Google
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ink-muted">
            <span className="h-px flex-1 bg-ink/20" />
            or
            <span className="h-px flex-1 bg-ink/20" />
          </div>

          <EmailSignInForm next={next} />

          <p className="text-xs text-ink-muted text-center">
            By continuing, you agree to display your pet&apos;s photo publicly if approved.{" "}
            <Link href="/rules" className="underline">
              Read the rules
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
