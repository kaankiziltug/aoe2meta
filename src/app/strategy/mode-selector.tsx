"use client";

import { useRouter } from "next/navigation";
import { GameMode } from "@/lib/api/types";

const MODES: { key: GameMode; label: string; active: boolean }[] = [
  { key: "rm-1v1",  label: "RM 1v1",  active: true  },
  { key: "rm-team", label: "RM Team", active: false },
  { key: "ew-1v1",  label: "EW 1v1",  active: false },
  { key: "ew-team", label: "EW Team", active: false },
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
        {MODES.map((m) =>
          m.active ? (
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
          ) : (
            <div key={m.key} className="group relative">
              <button
                disabled
                className="rounded-md px-3 py-1.5 text-xs font-medium cursor-not-allowed opacity-35 bg-muted text-muted-foreground"
              >
                {m.label}
              </button>
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover border border-border px-2.5 py-1 text-[11px] text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 z-50">
                Coming soon — RM 1v1 only for now
              </div>
            </div>
          )
        )}
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
