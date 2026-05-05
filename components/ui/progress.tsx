"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-5 w-full overflow-hidden rounded-full border-2 border-ink bg-cream-200",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full bg-ember-500 transition-transform duration-700"
      style={{
        transitionTimingFunction: "cubic-bezier(.2,.8,.2,1)",
        transform: `translateX(-${100 - (value ?? 0)}%)`,
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(10,10,10,.18) 0 6px, transparent 6px 14px)",
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = "Progress";
