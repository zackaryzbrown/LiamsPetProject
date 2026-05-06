import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
});
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Pets for Pups: A Soul Dog Rescue Fundraiser",
    template: "%s · Pets for Pups",
  },
  description:
    "A pet photo contest benefiting Soul Dog Rescue. Liam's Mile High Karate community service project. $1 donated = 1 vote.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://liams-pet-project-zacksbrodevs-projects.vercel.app",
  ),
  openGraph: {
    title: "Pets for Pups: A Soul Dog Rescue Fundraiser",
    description:
      "Submit your pet, vote with a donation, help shelter dogs find homes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
