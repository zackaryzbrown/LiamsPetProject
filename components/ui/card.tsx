import * as React from "react";
import { cn } from "@/lib/utils";

// Card primitives — the design-system baseline.
//
// Padding defaults (callers can still override with className):
//   CardHeader  : p-5 md:p-6
//   CardContent : p-6 md:p-8   <- the standard content body
//   CardFooter  : p-5 md:p-6
//
// Use `className="p-5"` (or similar) only for compact dashboard tiles
// or list rows where the default would feel oversized.

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("ink-card overflow-hidden", className)} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5 md:p-6 border-b-2 border-ink", className)} {...p} />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 md:p-8", className)} {...p} />
);
export const CardFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5 md:p-6 border-t-2 border-ink bg-cream-100", className)} {...p} />
);
