"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { submitContactMessage, type ContactResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ember" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Sending…
        </>
      ) : (
        <>
          Send message <Send className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}

function RequiredMark() {
  return (
    <span className="text-ember-500" aria-hidden>
      *
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs font-semibold text-ember-700" role="alert">
      {message}
    </p>
  );
}

export function ContactForm() {
  const [state, action] = useFormState<ContactResult | null, FormData>(
    submitContactMessage,
    null,
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  // Reset the form on success so the user can send another message.
  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (state?.ok) {
    return (
      <div
        role="status"
        className="grid gap-4 text-center px-2 py-8"
      >
        <div className="mx-auto grid place-items-center h-16 w-16 rounded-full border-2 border-ink bg-royal-100 text-royal-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="font-display text-2xl md:text-3xl font-black tracking-tight">
          Message sent.
        </p>
        <p className="mx-auto max-w-md text-ink-muted">
          Thanks for reaching out — we&apos;ll get back to you as soon as we can.
        </p>
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => {
              // Re-render the form by reloading the action state.
              window.location.reload();
            }}
          >
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  const fieldErr = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form ref={formRef} action={action} className="grid gap-5" noValidate>
      {/* Honeypot — must stay visually hidden but reachable by bots. */}
      <div
        aria-hidden
        className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state && !state.ok && !state.fieldErrors && (
        <div
          role="alert"
          className="rounded-xl border-2 border-ember-500 bg-ember-50 p-3 text-sm text-ember-700"
        >
          {state.error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">
            Your name <RequiredMark />
          </Label>
          <Input
            id="name"
            name="name"
            placeholder="Jane Doe"
            required
            autoComplete="name"
            aria-invalid={Boolean(fieldErr.name)}
            className={cn(fieldErr.name && "border-ember-500")}
          />
          <FieldError message={fieldErr.name} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">
            Email <RequiredMark />
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="jane@example.com"
            required
            autoComplete="email"
            aria-invalid={Boolean(fieldErr.email)}
            className={cn(fieldErr.email && "border-ember-500")}
          />
          <FieldError message={fieldErr.email} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          placeholder="What's this about?"
          aria-invalid={Boolean(fieldErr.subject)}
          className={cn(fieldErr.subject && "border-ember-500")}
        />
        <FieldError message={fieldErr.subject} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="message">
          Message <RequiredMark />
        </Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Type your message…"
          required
          minLength={10}
          maxLength={5000}
          aria-invalid={Boolean(fieldErr.message)}
          className={cn(fieldErr.message && "border-ember-500")}
        />
        <FieldError message={fieldErr.message} />
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
