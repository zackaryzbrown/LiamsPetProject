"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation";
import { submitPet, type SubmissionResult } from "@/app/(site)/enter/actions";
import { cn } from "@/lib/utils";

type Props = {
  defaultEmail?: string;
  defaultName?: string;
};

export function EnterPetForm({ defaultEmail, defaultName }: Props) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [topError, setTopError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<SubmissionResult & { ok: true } | null>(null);

  // File preview
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onPickFile(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(f.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setErrors((e) => ({ ...e, photo: "Photo must be a JPG, PNG, or WEBP image" }));
      input.value = "";
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setErrors((e) => ({ ...e, photo: "Photo must be 5MB or smaller" }));
      input.value = "";
      return;
    }
    setErrors(({ photo: _drop, ...rest }) => rest);
    setFile(f);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      let result: SubmissionResult;
      try {
        result = await submitPet(fd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Submission failed.";
        setTopError(
          /body exceeded/i.test(msg)
            ? "That photo is too large for the server to accept. Please try a smaller image (under 5MB)."
            : `Submission failed: ${msg}`,
        );
        return;
      }
      if (!result.ok) {
        setTopError(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      setSuccess(result);
      // Clear form (mostly for tidiness; we'll redirect shortly).
      formRef.current?.reset();
      setFile(null);
      // If Givebutter is configured, send the user to the donation URL.
      if (result.donationUrl) {
        // Give a beat for the success card to render before redirecting
        // outbound, so users see "submission saved" feedback.
        window.setTimeout(() => {
          window.location.href = result.donationUrl as string;
        }, 1200);
      } else {
        // No donation URL configured yet - route to /submitted with the id
        // so admins can still proceed manually.
        router.push(`/submitted?id=${result.submissionId}`);
      }
    });
  }

  if (success) {
    return (
      <div className="ink-card p-8 grid gap-4 animate-rise-in">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center h-12 w-12 rounded-full bg-ember-500 text-white border-2 border-ink">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <p className="eyebrow text-royal-700">Submission saved</p>
            <h2 className="font-display text-2xl font-black">Now: the $10 entry donation</h2>
          </div>
        </div>
        <p className="text-ink/85">
          Your pet has been saved with status <strong>pending payment</strong>. Complete your $10
          entry donation through Givebutter to lock in your spot. After that, an admin will review
          and approve your photo before it appears publicly.
        </p>
        {success.donationUrl ? (
          <Button asChild variant="ember" size="lg" className="w-full sm:w-auto">
            <a href={success.donationUrl}>
              Continue to Givebutter <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        ) : (
          <div className="rounded-xl border-2 border-ink bg-cream-100 p-4 text-sm">
            Donation link is not configured yet. Your submission ID is{" "}
            <code className="font-mono">{success.submissionId}</code>. Please contact the contest
            organizer to complete your entry donation.
          </div>
        )}
        <p className="text-xs text-ink-muted">
          Donations are processed by Givebutter. Donations are not refundable.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-6"
      aria-busy={isPending}
    >
      {topError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border-2 border-ember-500 bg-ember-50 p-3 text-sm text-ember-700"
        >
          {topError}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="ownerName">Owner name</Label>
        <Input
          id="ownerName"
          name="ownerName"
          defaultValue={defaultName ?? ""}
          placeholder="Jane Doe"
          required
          aria-invalid={!!errors.ownerName}
          aria-describedby={errors.ownerName ? "ownerName-error" : undefined}
        />
        {errors.ownerName && <FieldError id="ownerName-error" msg={errors.ownerName} />}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ownerEmail">Email</Label>
          <Input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            defaultValue={defaultEmail ?? ""}
            placeholder="jane@example.com"
            required
            aria-invalid={!!errors.ownerEmail}
            aria-describedby={errors.ownerEmail ? "ownerEmail-error" : undefined}
          />
          {errors.ownerEmail && <FieldError id="ownerEmail-error" msg={errors.ownerEmail} />}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ownerPhone">Phone</Label>
          <Input
            id="ownerPhone"
            name="ownerPhone"
            type="tel"
            placeholder="(555) 010-1234"
            aria-invalid={!!errors.ownerPhone}
            aria-describedby={errors.ownerPhone ? "ownerPhone-error" : undefined}
          />
          {errors.ownerPhone && <FieldError id="ownerPhone-error" msg={errors.ownerPhone} />}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="petName">Pet name</Label>
        <Input
          id="petName"
          name="petName"
          placeholder="Biscuit"
          required
          aria-invalid={!!errors.petName}
          aria-describedby={errors.petName ? "petName-error" : undefined}
        />
        {errors.petName && <FieldError id="petName-error" msg={errors.petName} />}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="photo">Pet photo</Label>
        <label
          htmlFor="photo"
          className={cn(
            "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink bg-cream-100 p-6 text-center cursor-pointer hover:bg-cream-200 transition min-h-44",
            errors.photo && "border-ember-500 bg-ember-50",
          )}
        >
          {previewUrl ? (
            <div className="grid grid-cols-[auto_1fr] gap-4 items-center w-full">
              <div className="relative h-28 w-28 rounded-xl overflow-hidden border-2 border-ink">
                <Image src={previewUrl} alt="Selected preview" fill className="object-cover" />
              </div>
              <div className="text-left">
                <p className="font-display text-lg font-black truncate">{file?.name}</p>
                <p className="text-sm text-ink-muted">
                  {file ? (file.size / 1024 / 1024).toFixed(1) : "0"} MB ·{" "}
                  {file?.type.replace("image/", "").toUpperCase()}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                    const input = document.getElementById("photo") as HTMLInputElement | null;
                    if (input) input.value = "";
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline text-ink-muted"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <>
              <ImagePlus className="h-8 w-8 text-royal-700" />
              <span className="mt-2 font-display text-xl font-black">Drop a photo here</span>
              <span className="mt-1 text-sm text-ink-muted">JPG, PNG, or WEBP · max 5MB</span>
            </>
          )}
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-invalid={!!errors.photo}
          aria-describedby={errors.photo ? "photo-error" : undefined}
          onChange={(e) => onPickFile(e.currentTarget)}
        />
        {errors.photo && <FieldError id="photo-error" msg={errors.photo} />}
      </div>

      <fieldset className="grid gap-3 rounded-xl border-2 border-ink bg-cream-100 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consentPublic"
            required
            className="mt-1 h-5 w-5 accent-ember-500"
          />
          <span>
            I grant permission to display this pet&apos;s photo publicly on this fundraiser site
            and related promotional materials.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acknowledgedNonrefundable"
            required
            className="mt-1 h-5 w-5 accent-ember-500"
          />
          <span>
            I understand the $10 entry donation is required and that{" "}
            <strong>donations are not refundable</strong>.
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-sm text-ink-muted max-w-md">
          After submitting, you&apos;ll be sent to Givebutter to complete the $10 entry donation.
        </p>
        <Button type="submit" variant="ember" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              Continue to donation <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ id, msg }: { id?: string; msg: string }) {
  return (
    <p id={id} role="alert" className="text-sm font-semibold text-ember-700">
      {msg}
    </p>
  );
}
