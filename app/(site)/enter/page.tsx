import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle, signOut } from "@/app/auth/actions";
import { EnterPetForm } from "@/components/EnterPetForm";

export const metadata = { title: "Enter your pet" };
// This page reads the user session, so it cannot be statically rendered.
export const dynamic = "force-dynamic";

export default async function EnterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <Hero />
        <section className="container py-14 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardContent className="p-8 grid gap-6 text-center sm:text-left">
              <Badge tone="ember" className="self-start">
                <Lock className="h-3.5 w-3.5" />
                Sign-in required
              </Badge>
              <div>
                <h2 className="font-display text-3xl font-black">Sign in to submit your pet</h2>
                <p className="mt-2 text-ink-muted max-w-prose">
                  We use Google sign-in so we can attach your submission to your account and
                  notify you when it&apos;s approved. Voters do <em>not</em> need an account.
                </p>
              </div>
              <form action={signInWithGoogle.bind(null, "/enter")} className="self-start">
                <Button type="submit" variant="ink" size="lg">
                  Continue with Google
                </Button>
              </form>
            </CardContent>
          </Card>
          <SideTips />
        </section>
      </>
    );
  }

  // Hard-stop if submissions are closed (server-side, not client-trustable).
  const { data: settings } = await supabase
    .from("contest_settings")
    .select("contest_open, submission_deadline")
    .eq("id", 1)
    .maybeSingle();
  const submissionsOpen =
    !!settings &&
    settings.contest_open &&
    new Date(settings.submission_deadline as string).getTime() > Date.now();

  if (!submissionsOpen) {
    return (
      <>
        <Hero email={user.email} />
        <section className="container py-14 max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center grid gap-3">
              <h2 className="font-display text-3xl font-black">Submissions are closed</h2>
              <p className="text-ink-muted">
                The submission deadline has passed for this fundraiser. You can still help by
                voting for the approved pets.
              </p>
              <div className="mt-2">
                <Button asChild variant="ember" size="lg">
                  <Link href="/vote">Go vote</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </>
    );
  }

  return (
    <>
      <Hero email={user.email} />
      <section className="container py-14 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="p-6 md:p-8">
            <EnterPetForm
              defaultEmail={user.email ?? undefined}
              defaultName={
                (user.user_metadata?.full_name as string | undefined) ??
                (user.user_metadata?.name as string | undefined)
              }
            />
          </CardContent>
        </Card>
        <SideTips signedInAs={user.email ?? undefined} />
      </section>
    </>
  );
}

function Hero({ email }: { email?: string | null }) {
  return (
    <section className="royal-panel border-b-2 border-ink">
      <div className="container py-14 md:py-20">
        <Badge tone="ember" className="border-cream/30">
          <Lock className="h-3.5 w-3.5" />
          {email ? `Signed in as ${email}` : "Google sign-in required"}
        </Badge>
        <h1 className="mt-5 font-display font-black text-cream text-5xl md:text-6xl tracking-tight">
          Enter your pet.
          <span className="block italic text-ember-300">Make Liam (and Soul Dog) proud.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-cream/85 text-lg">
          Submit your pet&apos;s photo, complete the $10 entry donation through Givebutter, and
          wait for admin approval. Once approved, your pet will appear on the public voting page.
        </p>
      </div>
    </section>
  );
}

function SideTips({ signedInAs }: { signedInAs?: string }) {
  return (
    <aside className="grid gap-6">
      {signedInAs && (
        <Card>
          <CardContent className="p-6">
            <p className="eyebrow text-royal-700">Signed in</p>
            <p className="mt-2 font-display text-lg font-black break-all">{signedInAs}</p>
            <form action={signOut} className="mt-3">
              <button type="submit" className="inline-flex items-center gap-1 text-sm underline text-ink-muted">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-6">
          <p className="eyebrow text-royal-700">Heads up</p>
          <h3 className="mt-2 font-display text-2xl font-black">
            Approval is required before your pet appears.
          </h3>
          <p className="mt-3 text-ink-muted">
            Submissions are reviewed by an admin. You&apos;ll get an email once your pet is
            approved (or if we have to ask for a different photo).
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="eyebrow text-royal-700">Multiple pets?</p>
          <p className="mt-2 text-ink-muted">
            You can enter as many pets as you&apos;d like — each one needs its own $10 entry
            donation.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
