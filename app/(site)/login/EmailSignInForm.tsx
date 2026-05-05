"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Mail } from "lucide-react";
import { signInWithEmail, type EmailSignInResult } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ember" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Sending link…
        </>
      ) : (
        <>
          <Mail className="h-4 w-4" /> Email me a sign-in link
        </>
      )}
    </Button>
  );
}

export function EmailSignInForm({ next }: { next: string }) {
  const [state, action] = useFormState<EmailSignInResult | null, FormData>(
    signInWithEmail,
    null,
  );

  if (state?.ok) {
    return (
      <div
        role="status"
        className="rounded-xl border-2 border-ink bg-cream-100 p-4 text-sm"
      >
        <p className="font-display text-lg font-black">Check your email</p>
        <p className="mt-1 text-ink-muted">
          We sent a sign-in link to <strong>{state.email}</strong>. Click it to finish signing
          in. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && (
        <div className="rounded-xl border-2 border-ember-500 bg-ember-50 p-3 text-sm text-ember-700">
          {state.error}
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
