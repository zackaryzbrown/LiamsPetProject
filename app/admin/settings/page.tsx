import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsForm } from "./_components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("contest_settings")
    .select(
      "submissions_open, voting_open, submission_deadline, voting_deadline, goal_amount_cents",
    )
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-black tracking-tight">Settings</h1>
        <p className="text-ink-muted">
          Controls public pages: submission/voting windows, deadlines, and the fundraiser goal.
        </p>
      </header>

      {settings ? (
        <SettingsForm
          initial={{
            submissionsOpen: settings.submissions_open,
            votingOpen: settings.voting_open,
            submissionDeadline: settings.submission_deadline,
            votingDeadline: settings.voting_deadline,
            goalAmountCents: settings.goal_amount_cents,
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center grid gap-2">
            <p className="font-display text-xl font-black">
              No contest_settings row found.
            </p>
            <p className="text-sm text-ink-muted">
              Apply the migrations and seed (insert a row with id=1) before continuing.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
