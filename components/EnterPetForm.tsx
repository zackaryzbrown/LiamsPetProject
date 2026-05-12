"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud } from "lucide-react";

type SubmitResult =
  | { ok: true; submissionId: string; donationUrl: string | null }
  | { ok: false; error: string };

type Props = {
  // Server action that creates the pending submission and returns the
  // pre-built Pledge.to entry donation URL. The form receives the URL
  // and redirects the donor straight to Pledge.to.
  action: (formData: FormData) => Promise<SubmitResult>;
};

// =====================================================================
// Pet entry form. Owners fill out their info + upload a photo. On
// successful submission we hand off to Pledge.to for the $10 entry
// donation. The webhook flips status to pending_review and an admin
// approves the photo before the pet appears publicly.
// =====================================================================
export function EnterPetForm({ action }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await action(fd);
          if (!r.ok) {
            setError(r.error);
            return;
          }
          // Hand off to Pledge.to for the $10 entry donation.
          if (r.donationUrl) {
            window.location.href = r.donationUrl;
            return;
          }
          router.push(`/submitted?id=${r.submissionId}`);
        });
      }}
    >
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="grid gap-2">
          <Label htmlFor="ownerName">Your name</Label>
          <Input id="ownerName" name="ownerName" required maxLength={120} placeholder="Jane Doe" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ownerEmail">Email</Label>
          <Input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            required
            maxLength={254}
            placeholder="jane@example.com"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="grid gap-2">
          <Label htmlFor="ownerPhone">Phone (optional)</Label>
          <Input id="ownerPhone" name="ownerPhone" maxLength={20} placeholder="555-555-1234" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="petName">Pet&apos;s name</Label>
          <Input id="petName" name="petName" required maxLength={80} placeholder="Biscuit" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="image">Pet photo (JPG/PNG/WEBP, max 5MB)</Label>
        <label
          htmlFor="image"
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-ink bg-cream-100 px-4 py-6 cursor-pointer hover:bg-cream-200 transition"
        >
          <UploadCloud className="h-5 w-5 text-royal-700" />
          <span className="font-semibold">
            {fileName ?? "Choose a photo of your pet"}
          </span>
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      <div className="grid gap-3 rounded-2xl border-2 border-ink bg-cream-100 p-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consentPublic"
            required
            className="mt-1 h-5 w-5 rounded border-2 border-ink"
          />
          <span>
            I consent to my pet&apos;s photo and name being displayed publicly on the voting page.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acknowledgedNonrefundable"
            required
            className="mt-1 h-5 w-5 rounded border-2 border-ink"
          />
          <span>
            I understand the $10 entry donation goes to Soul Dog Rescue via{" "}
            <strong>Pledge.to</strong> and is non-refundable.
          </span>
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border-2 border-ember-500 bg-ember-50 px-4 py-3 text-sm text-ember-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ember" size="lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Continue to $10 donation"
          )}
        </Button>
        <p className="text-sm text-ink-muted">
          You&apos;ll be sent to Pledge.to to complete your entry donation.
        </p>
      </div>

      <Textarea name="note" hidden readOnly aria-hidden tabIndex={-1} value="" />
    </form>
  );
}
