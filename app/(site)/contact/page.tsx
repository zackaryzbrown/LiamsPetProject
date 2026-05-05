import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight } from "lucide-react";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  // Contact email is configurable via env. The form below uses a mailto:
  // submission so we don't need to wire an email provider yet.
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
      </header>

      <Card>
        <CardContent className="p-6 md:p-8">
          <form
            className="grid gap-5"
            action={`mailto:${email}`}
            method="post"
            encType="text/plain"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" name="name" placeholder="Jane Doe" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="jane@example.com" required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" placeholder="What's this about?" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" name="message" rows={5} placeholder="Type your message…" required />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="ember" size="lg">
                Send <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
