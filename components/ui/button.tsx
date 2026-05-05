"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-royal-300/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ember:
          "bg-ember-500 text-white border-2 border-ink shadow-cta hover:-translate-y-[2px] active:translate-y-[2px] uppercase tracking-wide",
        ink:
          "bg-ink text-cream border-2 border-ink shadow-cta hover:-translate-y-[2px] active:translate-y-[2px] uppercase tracking-wide",
        ghost:
          "bg-white text-ink border-2 border-ink hover:bg-cream-200",
        royal:
          "bg-royal-600 text-white border-2 border-ink shadow-cta hover:-translate-y-[2px] active:translate-y-[2px] uppercase tracking-wide",
        link: "text-royal-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-6",
        lg: "h-14 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "ember", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };
