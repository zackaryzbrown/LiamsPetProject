import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border-2 border-ink bg-white px-4 py-2 text-base",
        "placeholder:text-ink-muted/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-royal-300/70",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-28 w-full rounded-xl border-2 border-ink bg-white px-4 py-3 text-base",
        "placeholder:text-ink-muted/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-royal-300/70",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
