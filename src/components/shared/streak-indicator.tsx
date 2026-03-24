import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function StreakIndicator({ streak }: { streak: number }) {
  if (streak === 0) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-sm">
        <Minus className="h-3 w-3" />
        0
      </span>
    );
  }

  const isWin = streak > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-sm font-medium",
        isWin ? "text-win" : "text-loss"
      )}
    >
      {isWin ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {Math.abs(streak)}
    </span>
  );
}
