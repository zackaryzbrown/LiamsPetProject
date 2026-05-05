import * as React from "react";
import { cn } from "@/lib/utils";

export const Badge = ({
  className,
  tone = "ink",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "ink" | "royal" | "ember" | "cream" }) => {
  const tones: Record<string, string> = {
    ink: "bg-ink text-cream",
    royal: "bg-royal-600 text-white",
    ember: "bg-ember-500 text-white",
    cream: "bg-cream-200 text-ink",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-widest",
        tones[tone],
        className
      )}
      {...props}
    />
  );
};
