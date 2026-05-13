import { Progress } from "./ui/progress";
import { formatCurrency } from "@/lib/utils";

type Props = { raisedCents: number; goalCents: number };

export function GoalProgress({ raisedCents, goalCents }: Props) {
  const pct =
    goalCents > 0
      ? Math.min(100, Math.round((raisedCents / goalCents) * 100))
      : 0;
  return (
    <div className="ink-card p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-royal-700">Fundraiser progress</p>
          <p className="mt-1 font-display text-4xl md:text-5xl font-black tracking-tight">
            {formatCurrency(raisedCents)}
            <span className="text-ink-muted/70 text-2xl md:text-3xl font-semibold">
              {" "}/ {formatCurrency(goalCents)}
            </span>
          </p>
        </div>
        <div className="stamp h-16 w-16 text-xl">{pct}%</div>
      </div>
      <div className="mt-5">
        <Progress value={pct} />
      </div>
      <p className="mt-3 text-sm text-ink-muted">
        Every dollar = one vote. Every dollar helps Soul Dog Rescue.
      </p>
    </div>
  );
}
