import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnterPetForm } from "@/components/EnterPetForm";
import { enterPet } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getPublicContest } from "@/lib/public-data";
import { ArrowRight, Heart } from "lucide-react";

export const metadata = { title: "Enter your pet" };
export const dynamic = "force-dynamic";

export default async function EnterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/enter");
  }

  const contest = await getPublicContest();
  const submissionsOpen = contest?.submissionsOpen ?? true;

  return (
    <section className="container py-12 md:py-20 grid gap-10 lg:grid-cols-[1fr_400px]">
      <div>
        <p className="eyebrow text-royal-700">Enter your pet</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
          Submit your pet. <span className="italic text-ember-500">Help a shelter dog.</span>
        </h1>
        <p className="mt-5 text-lg text-ink-muted max-w-xl">
          Fill out the form below and you&apos;ll be redirected to{" "}
          <strong>Pledge.to</strong> to complete the $10 entry donation. Every dollar goes to Soul
          Dog Rescue.
        </p>

        <div className="mt-10">
          <Card>
            <CardContent className="p-6 md:p-8">
              {submissionsOpen ? (
                <EnterPetForm action={enterPet} />
              ) : (
                <div className="grid gap-4 text-center py-8">
                  <p className="font-display text-2xl font-black">
                    Submissions are currently closed.
                  </p>
                  <p className="text-ink-muted">
                    You can still vote for entered pets — every dollar still goes to Soul Dog
                    Rescue.
                  </p>
                  <div className="flex justify-center">
                    <Button asChild variant="ember" size="lg">
                      <Link href="/vote">
                        Donate to vote <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <aside className="grid gap-4 self-start">
        <Card>
          <CardContent className="p-6 grid gap-3">
            <p className="eyebrow text-royal-700">What you&apos;re paying for</p>
            <p className="font-display text-2xl font-black tracking-tight">
              $10 entry · 100% to Soul Dog Rescue
            </p>
            <p className="text-sm text-ink-muted">
              The $10 entry donation is processed by Pledge.to and is non-refundable.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 grid gap-3">
            <Heart className="h-5 w-5 text-ember-500" />
            <p className="font-display text-xl font-black">
              Your pet appears after approval
            </p>
            <p className="text-sm text-ink-muted">
              Once Pledge.to confirms your entry donation and an admin approves the photo, your
              pet shows up on the public voting page.
            </p>
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}
