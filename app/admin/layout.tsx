import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Inbox, Trophy, Settings, LogOut, ShieldCheck, GitMerge, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/submissions", label: "Submissions", icon: Inbox },
  { href: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/admin/reconciliation", label: "Reconciliation", icon: GitMerge },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b-2 border-ink bg-ink text-cream">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-ember-500 border-2 border-cream">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="font-display text-xl font-black tracking-tight">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge tone="cream" className="hidden sm:inline-flex">
              {email}
            </Badge>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-cream bg-cream px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-cream-200"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View site
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-sm underline text-cream/80 hover:text-cream"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="container grid lg:grid-cols-[220px_1fr] gap-8 py-8">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <nav className="grid gap-1 p-2 rounded-2xl border-2 border-ink bg-white shadow-card">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-cream-200"
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
