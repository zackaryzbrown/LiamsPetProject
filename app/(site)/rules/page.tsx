import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Rules & FAQ" };

const RULES = [
  "Any pet is welcome: dogs, cats, rabbits, lizards, parrots. If they're loved, they qualify.",
  "Multiple pets are allowed. Each pet requires its own $10 minimum entry donation.",
  "$1 donated = 1 vote. Votes are unlimited.",
  "Votes can be split across pets by making separate donations.",
  "Submission deadline: November 13 at 11:59 PM.",
  "Voting deadline: November 13 at 11:59 PM.",
  "Donations are not refundable.",
  "Inappropriate or unsafe submissions can be rejected at the admin's discretion.",
  "Admin approval is required before a pet appears on the public voting page.",
  "Winner is determined by the highest verified vote total.",
];

const FAQ = [
  {
    q: "What does the $10 entry donation do?",
    a: "It enters your pet into the contest, and it counts as your pet's first 10 votes since $1 = 1 vote. All donations go to Soul Dog Rescue.",
  },
  {
    q: "Do voters need to make an account?",
    a: "No. Anyone can donate to vote. Only people submitting a pet need to sign in (with Google).",
  },
  {
    q: "What are the prizes?",
    a: "1st place: a $100 Chewy gift card and a custom pet portrait. 2nd place: a custom pet pillow.",
  },
  {
    q: "How are vote totals calculated?",
    a: "We use Givebutter as the payment processor. Every donation that's matched to a pet contributes votes equal to whole dollars donated.",
  },
  {
    q: "Can I update my pet's photo after submitting?",
    a: "Reach out via the Contact page and we'll help. We try to keep things simple.",
  },
];

export default function RulesPage() {
  return (
    <section className="container py-16 md:py-24 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
      <header>
        <p className="eyebrow text-royal-700">The fine print</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
          Rules &amp;<span className="italic text-ember-500"> FAQ</span>.
        </h1>
        <p className="mt-5 text-ink-muted text-lg">
          Be kind, donate what you can. Every dollar helps a shelter dog.
        </p>
      </header>

      <div className="grid gap-8">
        <Card>
          <CardContent className="p-6 md:p-8">
            <h2 className="font-display text-2xl font-black">The rules</h2>
            <ol className="mt-4 grid gap-3 list-decimal list-inside text-ink/90">
              {RULES.map((r) => (
                <li key={r} className="leading-relaxed">{r}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <h2 className="font-display text-3xl font-black">FAQ</h2>
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group ink-card p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-lg font-black">
                {f.q}
                <span className="grid place-items-center h-8 w-8 rounded-full border-2 border-ink bg-cream group-open:bg-ember-500 group-open:text-white transition">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink/85 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
