import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaveDivider } from "@/components/WaveDivider";

export const metadata = { title: "About the cause" };

export default function AboutPage() {
  return (
    <>
      <section className="container py-16 md:py-24">
        <p className="eyebrow text-royal-700">About</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight max-w-3xl">
          A karate kid raising <span className="italic text-ember-500">$500</span> for shelter
          dogs.
        </h1>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <p className="text-lg text-ink/85 leading-relaxed">
            This fundraiser benefits <strong>Soul Dog Rescue</strong>, a local nonprofit that pulls
            dogs from overcrowded shelters and matches them with adopters who&apos;ll love them
            forever. Every dollar pays for transport, vet care, and food.
          </p>
          <p className="text-lg text-ink/85 leading-relaxed">
            It&apos;s also <strong>Liam&apos;s community service project</strong> through Mile High
            Karate. Black belt requirements include showing up for your community, and this is
            how Liam is showing up.
          </p>
        </div>
      </section>

      <WaveDivider direction="down" className="text-ink" />
      <section className="bg-ink text-cream">
        <div className="container py-16 md:py-20 grid md:grid-cols-3 gap-6">
          {[
            {
              k: "Soul Dog Rescue",
              v: "Pulls and places dogs from overcrowded shelters into loving homes.",
            },
            {
              k: "Mile High Karate",
              v: "Liam's dojo. Discipline, respect, and giving back to the community.",
            },
            {
              k: "Liam's Project",
              v: "Raising $500 for shelter dogs through pet photo voting.",
            },
          ].map((b) => (
            <Card key={b.k} className="bg-cream text-ink">
              <CardContent className="p-6">
                <p className="eyebrow text-royal-700">{b.k}</p>
                <p className="mt-2 text-lg leading-relaxed">{b.v}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="container pb-16 flex flex-wrap gap-3">
          <Button asChild variant="ember" size="lg">
            <Link href="/enter">Enter your pet</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="bg-cream/95">
            <Link href="/vote">Vote with a donation</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
