import { Metadata } from "next";
import Image from "next/image";
import { Map, Trophy, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createDataProvider } from "@/lib/api/provider";
import { getCivImageUrl } from "@/lib/constants";
import { GameMode, MapCivStat, MapStats } from "@/lib/api/types";
import { ModeSelector } from "./mode-selector";

export const metadata: Metadata = {
  title: "Map Statistics",
  description:
    "Age of Empires II map statistics. Best and worst civilizations for every AoE2 map including Arabia, Arena, and more.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CivRow({ civ }: { civ: MapCivStat }) {
  const isGood = civ.winRate >= 50;
  return (
    <div className="flex items-center gap-2 py-1">
      <Image
        src={getCivImageUrl(civ.civName)}
        alt={civ.civName}
        width={24}
        height={24}
        unoptimized
        className="rounded-sm object-cover"
      />
      <span className="flex-1 truncate text-sm text-foreground">
        {civ.civName}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          isGood ? "text-green-400" : "text-red-400"
        }`}
      >
        {civ.winRate.toFixed(1)}%
      </span>
    </div>
  );
}

function MapCard({ map }: { map: MapStats }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-orange-400">
            <Map className="h-4 w-4 shrink-0" />
            {map.mapName}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {formatGames(map.totalGames)} games
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-x-4">
          {/* Best civs */}
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-green-400">
              <Trophy className="h-3 w-3" />
              Best Civs
            </div>
            <div className="space-y-0.5">
              {map.topCivs.map((civ) => (
                <CivRow key={civ.civName} civ={civ} />
              ))}
            </div>
          </div>

          {/* Worst civs */}
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Worst Civs
            </div>
            <div className="space-y-0.5">
              {map.bottomCivs.map((civ) => (
                <CivRow key={civ.civName} civ={civ} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const ELO_OPTIONS = [
  { key: "all",      label: "All ELOs" },
  { key: "low",      label: "< 800"    },
  { key: "med_low",  label: "800–1100" },
  { key: "medium",   label: "1100–1400"},
  { key: "med_high", label: "1400–1800"},
  { key: "high",     label: "1800+"    },
] as const;

const ELO_RANGES: Record<string, [number, number] | undefined> = {
  low:      [0,    799],
  med_low:  [800,  1099],
  medium:   [1100, 1399],
  med_high: [1400, 1799],
  high:     [1800, 9999],
};

export default async function MapsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; elo?: string }>;
}) {
  const { mode: modeParam, elo: eloParam } = await searchParams;
  const mode = (modeParam ?? "rm-1v1") as GameMode;
  const eloKey = eloParam ?? "all";
  const eloRange = ELO_RANGES[eloKey];

  const provider = createDataProvider();
  const maps = await provider.getMapStats(mode, eloRange);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-orange-400">
          Map Statistics
        </h1>
        <p className="mt-1 text-muted-foreground">
          Best and worst civilizations per map · Last 30 days
        </p>
      </div>

      {/* Filters row */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <ModeSelector currentMode={mode} currentElo={eloKey} />

        {/* ELO selector */}
        <div className="flex flex-wrap gap-1.5">
          {ELO_OPTIONS.map((opt) => (
            <a
              key={opt.key}
              href={`/maps?mode=${mode}&elo=${opt.key}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                eloKey === opt.key
                  ? "bg-orange-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </a>
          ))}
        </div>
      </div>

      {/* Map grid */}
      {maps.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          No map data available for this ELO range yet. Check back later.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {maps.map((map) => (
            <MapCard key={map.mapSlug} map={map} />
          ))}
        </div>
      )}
    </main>
  );
}
