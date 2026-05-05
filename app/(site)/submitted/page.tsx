import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Submission received" };

export default async function SubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <section className="container py-20 max-w-2xl">
      <Card>
        <CardContent className="p-8 grid gap-5 text-center">
          <span className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-ember-500 text-white border-2 border-ink">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight">
            Submission received.
          </h1>
          <p className="text-ink-muted">
            Thanks for entering. Your pet is now in the queue with status{" "}
            <strong>pending payment</strong>. Once your $10 entry donation is confirmed and an
            admin approves the photo, your pet will appear publicly on the voting page.
          </p>
          {id && (
            <p className="text-xs text-ink-muted">
              Submission ID: <code className="font-mono">{id}</code>
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild variant="ember" size="lg">
              <Link href="/vote">View other pets</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/">Back home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
