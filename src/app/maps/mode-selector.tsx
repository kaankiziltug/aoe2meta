"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameMode } from "@/lib/api/types";

const MODES: { id: GameMode; label: string }[] = [
  { id: "rm-1v1", label: "RM 1v1" },
  { id: "rm-team", label: "RM Team" },
  { id: "ew-1v1", label: "EW 1v1" },
  { id: "ew-team", label: "EW Team" },
];

interface ModeSelectorProps {
  currentMode: GameMode;
  currentElo?: string;
}

export function ModeSelector({ currentMode, currentElo = "all" }: ModeSelectorProps) {
  const router = useRouter();

  return (
    <Tabs
      value={currentMode}
      onValueChange={(v) => {
        router.push(`/maps?mode=${v}&elo=${currentElo}`);
      }}
    >
      <TabsList className="h-9">
        {MODES.map((m) => (
          <TabsTrigger key={m.id} value={m.id} className="text-xs">
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
