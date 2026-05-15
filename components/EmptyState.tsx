import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PawMark } from "@/components/PawMark";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type EmptyStateAction = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  action?: EmptyStateAction;
  /**
   * - "card": cream Card with ink border (default, for content areas)
   * - "ink": ink-on-cream watermarked panel (for use inside the dark Leaderboard card)
   * - "bare": no outer chrome (caller supplies the wrapper)
   */
  variant?: "card" | "ink" | "bare";
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  variant = "card",
  className,
}: EmptyStateProps) {
  const inner = (
    <div className="relative overflow-hidden">
      <PawMark
        size={220}
        className={cn(
          "pointer-events-none absolute -right-10 -bottom-12 opacity-[0.06] -rotate-12",
          variant === "ink" ? "text-cream" : "text-ink",
        )}
      />
      <div className="relative grid gap-3 text-center px-6 py-10 md:py-12">
        <p
          className={cn(
            "font-display text-2xl md:text-3xl font-black tracking-tight",
            variant === "ink" ? "text-cream" : "text-ink",
          )}
        >
          {title}
        </p>
        {description ? (
          <div
            className={cn(
              "mx-auto max-w-md text-sm md:text-base",
              variant === "ink" ? "text-cream/75" : "text-ink-muted",
            )}
          >
            {description}
          </div>
        ) : null}
        {action ? (
          <div className="mt-2 flex justify-center">
            <Button asChild variant="ember" size="lg">
              <Link href={action.href}>
                {action.label}
                {action.icon}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (variant === "bare") {
    return <div className={className}>{inner}</div>;
  }

  if (variant === "ink") {
    return (
      <div
        className={cn(
          "rounded-2xl border-2 border-ink bg-ink/95 text-cream",
          className,
        )}
      >
        {inner}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  );
}
