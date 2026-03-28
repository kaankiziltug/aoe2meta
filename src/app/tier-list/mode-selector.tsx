"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { GAME_MODES } from "@/lib/constants";
import { GameMode } from "@/lib/api/types";

const TIER_LIST_MODES = GAME_MODES.slice(0, 4); // RM 1v1, RM Team, EW 1v1, EW Team

const ELO_OPTIONS = [
  { key: "all",       label: "All ELOs" },
  { key: "1000-1400", label: "1000–1400" },
  { key: "1400-1800", label: "1400–1800" },
  { key: "1800+",     label: "1800+" },
  { key: "2000+",     label: "2000+" },
];

interface ModeSelectorProps {
  currentMode: GameMode;
  currentElo: string;
}

export function ModeSelector({ currentMode, currentElo }: ModeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleModeChange(mode: GameMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    router.push(`/tier-list?${params.toString()}`);
  }

  function handleEloChange(elo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (elo === "all") params.delete("elo");
    else params.set("elo", elo);
    router.push(`/tier-list?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {TIER_LIST_MODES.map((m) => {
          const isActive = currentMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                isActive
                  ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {m.shortLabel}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ELO_OPTIONS.map((opt) => {
          const isActive = currentElo === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleEloChange(opt.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                isActive
                  ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
