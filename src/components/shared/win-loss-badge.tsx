import { cn } from "@/lib/utils";

interface WinLossBadgeProps {
  wins: number;
  losses: number;
  showRate?: boolean;
}

export function WinLossBadge({ wins, losses, showRate = true }: WinLossBadgeProps) {
  const total = wins + losses;
  const rate = total > 0 ? (wins / total) * 100 : 0;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-win font-medium">{wins}W</span>
      <span className="text-muted-foreground">/</span>
      <span className="text-loss font-medium">{losses}L</span>
      {showRate && total > 0 && (
        <span
          className={cn(
            "ml-1 text-xs font-mono",
            rate >= 52 ? "text-win" : rate <= 48 ? "text-loss" : "text-muted-foreground"
          )}
        >
          ({rate.toFixed(1)}%)
        </span>
      )}
    </div>
  );
}
