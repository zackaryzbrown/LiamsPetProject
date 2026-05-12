"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PawMark } from "./PawMark";
import { Button } from "./ui/button";
import { Menu, X } from "lucide-react";
import * as React from "react";
import { signOut } from "@/app/auth/actions";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/vote", label: "Vote" },
  { href: "/about", label: "The Cause" },
  { href: "/rules", label: "Rules / FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Navbar({
  isAdmin = false,
  isSignedIn = false,
  donateUrl = null,
}: {
  isAdmin?: boolean;
  isSignedIn?: boolean;
  // Default Pledge.to fundraiser URL for the contest. When set, the
  // Donate button opens it in a new tab. Otherwise it falls back to
  // /vote so the user can pick a specific pet.
  donateUrl?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-cream/85 backdrop-blur supports-[backdrop-filter]:bg-cream/70">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="grid place-items-center h-9 w-9 rounded-full bg-ember-500 text-white border-2 border-ink">
            <PawMark size={18} />
          </span>
          <span className="font-display text-xl font-black tracking-tight">
            Pets<span className="italic text-royal-700">for</span>Pups
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-3 py-2 rounded-full text-sm font-semibold tracking-wide transition",
                  active ? "bg-ink text-cream" : "hover:bg-cream-200",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Admin</Link>
            </Button>
          )}
          {isSignedIn && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/account">Account</Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/enter">Enter Your Pet</Link>
          </Button>
          {isSignedIn ? (
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Log out
              </Button>
            </form>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`}>
                Log in
              </Link>
            </Button>
          )}
          <Button asChild variant="ember" size="sm">
            {donateUrl ? (
              <a href={donateUrl} target="_blank" rel="noopener noreferrer">
                Donate
              </a>
            ) : (
              <Link href="/vote">Donate</Link>
            )}
          </Button>
        </div>

        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden grid place-items-center h-11 w-11 rounded-full border-2 border-ink bg-white"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="md:hidden border-t-2 border-ink bg-cream"
        >
          <div className="container py-4 grid gap-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-xl border-2 border-ink bg-white font-semibold"
              >
                {item.label}
              </Link>
            ))}
            <Button asChild variant="ember" size="lg" className="mt-1">
              {donateUrl ? (
                <a
                  href={donateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  Donate
                </a>
              ) : (
                <Link href="/vote" onClick={() => setOpen(false)}>
                  Donate
                </Link>
              )}
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/enter" onClick={() => setOpen(false)}>
                Enter Your Pet
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="lg">
                <Link href="/admin" onClick={() => setOpen(false)}>
                  Admin
                </Link>
              </Button>
            )}
            {isSignedIn && (
              <Button asChild variant="ghost" size="lg">
                <Link href="/account" onClick={() => setOpen(false)}>
                  Account
                </Link>
              </Button>
            )}
            {isSignedIn ? (
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="lg"
                  className="w-full"
                >
                  Log out
                </Button>
              </form>
            ) : (
              <Button asChild variant="ghost" size="lg">
                <Link
                  href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                  onClick={() => setOpen(false)}
                >
                  Log in
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
