import Link from "next/link";
import { PawMark } from "./PawMark";

export function Footer() {
  const year = new Date().getFullYear();
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@example.org";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <footer className="relative bg-royal-700 text-cream border-t-2 border-ink mt-24">
      <div className="container py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-ember-500 text-white border-2 border-ink">
              <PawMark size={18} />
            </span>
            <span className="font-display text-2xl font-black">
              Pets<span className="italic">for</span>Pups
            </span>
          </div>
          <p className="mt-4 max-w-md text-cream/85">
            A pet-photo fundraiser benefiting{" "}
            <span className="font-semibold text-white">Soul Dog Rescue</span>. A community service
            project by Liam &amp; Mile High Karate.
          </p>
        </div>
        <div>
          <h4 className="eyebrow text-ember-200/90">Explore</h4>
          <ul className="mt-3 space-y-2 text-cream/90">
            <li><Link href="/vote" className="hover:underline">Vote</Link></li>
            <li><Link href="/enter" className="hover:underline">Enter your pet</Link></li>
            <li><Link href="/about" className="hover:underline">About the cause</Link></li>
            <li><Link href="/rules" className="hover:underline">Rules / FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="eyebrow text-ember-200/90">Get in touch</h4>
          <ul className="mt-3 space-y-2 text-cream/90">
            <li>
              <a className="hover:underline" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </li>
            <li><Link href="/contact" className="hover:underline">Contact form</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t-2 border-ink/60">
        <div className="container py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-cream/70">
          <p>© {year} Pets for Pups · Built for Soul Dog Rescue</p>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            {supportEmail && (
              <p>
                Site issue?{" "}
                <a
                  className="underline decoration-cream/40 hover:decoration-cream"
                  href={`mailto:${supportEmail}?subject=PetsForPups%20site%20issue`}
                >
                  {supportEmail}
                </a>
              </p>
            )}
            <p className="italic">Donations are not refundable. $1 donated = 1 vote.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
