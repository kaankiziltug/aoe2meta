"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { GAME_MODES } from "@/lib/constants";
import { GameMode } from "@/lib/api/types";

const META_MODES = GAME_MODES.slice(0, 4); // RM 1v1, RM Team, EW 1v1, EW Team

interface ModeSelectorProps {
  currentMode: GameMode;
}

export function ModeSelector({ currentMode }: ModeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleModeChange(mode: GameMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    router.push(`/meta?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {META_MODES.map((m) => {
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
  );
}
