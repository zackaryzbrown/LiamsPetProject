import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

type Props = {
  contestOpen: boolean;
  votingDeadline: string | Date;
  className?: string;
};

export function ContestStatusBadge({ contestOpen, votingDeadline, className }: Props) {
  const deadline = new Date(votingDeadline);
  const open = contestOpen && Date.now() < deadline.getTime();
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(deadline);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge tone={open ? "ember" : "ink"}>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            open ? "bg-white animate-pulse" : "bg-cream-200"
          )}
        />
        {open ? "Voting open" : "Voting closed"}
      </Badge>
      <Badge tone="cream">Closes {fmt}</Badge>
    </div>
  );
}
