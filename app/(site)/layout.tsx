import { NavbarServer } from "@/components/NavbarServer";
import { Footer } from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:border-2 focus:border-ink focus:bg-ember-500 focus:text-white focus:font-semibold"
      >
        Skip to main content
      </a>
      <NavbarServer />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
