"use client";

import { useRouter } from "next/navigation";
import { GameMode } from "@/lib/api/types";

const MODES: { key: GameMode; label: string }[] = [
  { key: "rm-1v1",  label: "RM 1v1"  },
  { key: "rm-team", label: "RM Team" },
  { key: "ew-1v1",  label: "EW 1v1"  },
  { key: "ew-team", label: "EW Team" },
];

interface Props {
  currentMode: GameMode;
  currentMap:  string;
  currentElo:  string;
  mapList:     string[];
}

export function ModeSelector({ currentMode, currentMap, currentElo, mapList }: Props) {
  const router = useRouter();

  function nav(mode: GameMode, map: string, elo: string) {
    router.push(`/strategy?mode=${mode}&map=${map}&elo=${elo}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode pills */}
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => nav(m.key, currentMap, currentElo)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              currentMode === m.key
                ? "bg-orange-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Map select */}
      {mapList.length > 0 && (
        <select
          value={currentMap}
          onChange={(e) => nav(currentMode, e.target.value, currentElo)}
          className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          {mapList.map((slug) => (
            <option key={slug} value={slug}>
              {slug
                .split("_")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
