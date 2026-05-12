import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Rules & FAQ" };

const RULES: { q: string; a: React.ReactNode }[] = [
  {
    q: "How does voting work?",
    a: (
      <>
        Every <strong>$1 you donate on Pledge.to = 1 vote</strong> for the pet you donated to.
        There&apos;s no separate ticketing system. Donate $5, your pet gets 5 votes. Tips and
        processing fees that Pledge.to charges do <em>not</em> count toward votes — only the
        donation amount does.
      </>
    ),
  },
  {
    q: "What does it cost to enter?",
    a: (
      <>
        $10. The entry donation is paid through Pledge.to and goes to Soul Dog Rescue. The entry
        donation is non-refundable and does <em>not</em> count as a vote for your own pet.
      </>
    ),
  },
  {
    q: "How do I pay?",
    a: (
      <>
        Pledge.to is the only donation platform. After you submit your pet, you&apos;ll be
        redirected to Pledge.to to complete your $10 entry donation. The same applies to votes —
        every vote happens on Pledge.to.
      </>
    ),
  },
  {
    q: "When does my pet appear on the voting page?",
    a: (
      <>
        After your $10 entry donation is confirmed by Pledge.to <em>and</em> an admin approves
        your photo. Approval usually happens within 24 hours.
      </>
    ),
  },
  {
    q: "What if my photo is rejected?",
    a: (
      <>
        We&apos;ll email you the reason. Common reasons: photo is not of a pet, photo is too dark
        or blurry, or it contains personal info we can&apos;t display publicly. The $10 entry
        donation still benefits Soul Dog Rescue and is non-refundable.
      </>
    ),
  },
  {
    q: "Is my donation tax-deductible?",
    a: (
      <>
        Donations to Soul Dog Rescue made through Pledge.to are tax-deductible to the extent
        allowed by law. Your Pledge.to receipt is your record.
      </>
    ),
  },
  {
    q: "When does voting close?",
    a: <>See the countdown on the homepage. After the deadline, the leaderboard is final.</>,
  },
];

export default function RulesPage() {
  return (
    <section className="container py-16 md:py-24 max-w-4xl">
      <p className="eyebrow text-royal-700">Rules &amp; FAQ</p>
      <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
        The fine print, <span className="italic text-ember-500">in plain English</span>.
      </h1>

      <ol className="mt-10 grid gap-4">
        {RULES.map((item, i) => (
          <li key={item.q}>
            <Card>
              <CardContent className="p-6 grid gap-2">
                <div className="flex items-baseline gap-3">
                  <span className="stamp h-9 w-9 text-sm">{i + 1}</span>
                  <h2 className="font-display text-xl md:text-2xl font-black">{item.q}</h2>
                </div>
                <p className="pl-12 text-ink/85 leading-relaxed">{item.a}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild variant="ember" size="lg">
          <Link href="/enter">Enter your pet</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/vote">Donate to vote</Link>
        </Button>
      </div>
    </section>
  );
}
