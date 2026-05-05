import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsForm } from "./_components/SettingsForm";

export const dynamic = "force-dynamic";

// Returns the value formatted for an <input type="datetime-local"/>.
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function SettingsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contest_settings")
    .select("contest_open, submission_deadline, voting_deadline, goal_amount_cents")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="grid gap-6 max-w-3xl">
      <div>
        <p className="eyebrow text-royal-700">Settings</p>
        <h1 className="font-display text-4xl font-black">Contest settings</h1>
        <p className="text-ink-muted mt-1">
          Open or close the contest, set deadlines, and adjust the fundraising goal.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <SettingsForm
            contestOpen={!!data?.contest_open}
            submissionDeadline={toLocalInputValue(data?.submission_deadline as string)}
            votingDeadline={toLocalInputValue(data?.voting_deadline as string)}
            goalAmountDollars={
              typeof data?.goal_amount_cents === "number"
                ? (data.goal_amount_cents / 100).toFixed(2)
                : "0"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
