import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { ContactForm } from "./ContactForm";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@example.org";
  return (
    <section className="container py-16 md:py-24 grid gap-10 lg:grid-cols-2">
      <header>
        <p className="eyebrow text-royal-700">Contact</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl font-black tracking-tight">
          Get in <span className="italic text-ember-500">touch</span>.
        </h1>
        <p className="mt-5 text-ink-muted text-lg max-w-md">
          Questions about the contest, your submission, or Soul Dog Rescue? Send us a note and
          we&apos;ll get back to you.
        </p>
        <a
          href={`mailto:${email}`}
          className="mt-8 inline-flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-5 shadow-card-sm hover:-translate-y-[2px] transition"
        >
          <span className="grid place-items-center h-12 w-12 rounded-full bg-ember-500 text-white border-2 border-ink">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow text-royal-700">Email</p>
            <p className="font-display text-xl font-black">{email}</p>
          </div>
        </a>
        <p className="mt-6 text-sm text-ink-muted max-w-md">
          Prefer email? Either way works — the form sends straight to us, no inbox-hop
          required.
        </p>
      </header>

      <Card>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </section>
  );
}
