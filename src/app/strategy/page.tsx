import { Metadata } from "next";
import Image from "next/image";
import { Clock, Swords, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createDataProvider } from "@/lib/api/provider";
import { getCivImageUrl } from "@/lib/constants";
import { GameMode, OpeningStat, CivOpeningStats } from "@/lib/api/types";
import { ModeSelector } from "./mode-selector";

// ── Coming soon guard ─────────────────────────────────────────────────────────
const COMING_SOON = false; // flip to false once strategy-stats.json has sufficient data

export const metadata: Metadata = {
  title: "Opening Strategies",
  description:
    "Age of Empires II opening strategy statistics. Most popular and highest win-rate openings per civilization — Archer Rush, Scout Rush, Drush FC, Fast Castle and more.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const OPENING_COLORS: Record<string, string> = {
  "Archer Rush":   "bg-yellow-500",
  "Scout Rush":    "bg-orange-500",
  "Drush FC":      "bg-purple-500",
  "Drush":         "bg-violet-400",
  "Drush Archers": "bg-fuchsia-500",
  "Drush M@A":     "bg-pink-500",
  "M@A Archers":   "bg-red-500",
  "M@A Rush":      "bg-rose-500",
  "Fast Castle":   "bg-blue-500",
  "Pike Skirm":    "bg-green-500",
  "Tower Rush":    "bg-amber-600",
  "Other":         "bg-muted-foreground/40",
};

function openingColor(name: string) {
  return OPENING_COLORS[name] ?? "bg-muted-foreground/40";
}

const ELO_OPTIONS = [
  { key: "all",       label: "All ELOs",  active: true  },
  { key: "<1000",     label: "< 1000",    active: false },
  { key: "1000-1400", label: "1000–1400", active: false },
  { key: "1400-1800", label: "1400–1800", active: false },
  { key: "1800+",     label: "1800+",     active: true  },
] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function OpeningBar({ stat, maxGames }: { stat: OpeningStat; maxGames: number }) {
  const pct = maxGames > 0 ? (stat.games / maxGames) * 100 : 0;
  const isGood = stat.winRate >= 52;
  const isBad  = stat.winRate < 48;
  return (
    <div className="group flex items-center gap-2 py-1">
      <div className="w-24 shrink-0 truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">
        {stat.opening}
      </div>
      <div className="flex-1 overflow-hidden rounded-full bg-muted/40 h-3">
        <div
          className={`h-full rounded-full transition-all ${openingColor(stat.opening)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {stat.games}
      </div>
      <div
        className={`w-12 text-right text-xs font-semibold tabular-nums ${
          isGood ? "text-green-400" : isBad ? "text-red-400" : "text-foreground"
        }`}
      >
        {stat.winRate.toFixed(1)}%
      </div>
    </div>
  );
}

function GlobalOpeningCard({ openings }: { openings: OpeningStat[] }) {
  const maxGames = openings[0]?.games ?? 1;
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-orange-400">
          <Swords className="h-4 w-4 shrink-0" />
          All Civilizations — Opening Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-0.5">
        {/* header row */}
        <div className="flex items-center gap-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">
          <div className="w-24 shrink-0">Opening</div>
          <div className="flex-1">Usage</div>
          <div className="w-10 text-right">Games</div>
          <div className="w-12 text-right">Win%</div>
        </div>
        {openings.map((s) => (
          <OpeningBar key={s.opening} stat={s} maxGames={maxGames} />
        ))}
      </CardContent>
    </Card>
  );
}

function CivCard({ civ }: { civ: CivOpeningStats }) {
  const top3 = civ.openings.slice(0, 3);
  const maxGames = civ.openings[0]?.games ?? 1;
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src={getCivImageUrl(civ.civName)}
              alt={civ.civName}
              width={28}
              height={28}
              unoptimized
              className="rounded-sm object-cover"
            />
            <span className="text-sm font-semibold text-foreground">{civ.civName}</span>
          </div>
          <span className="text-xs text-muted-foreground">{civ.totalGames} games</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-0.5">
        {top3.map((s) => (
          <OpeningBar key={s.opening} stat={s} maxGames={maxGames} />
        ))}
        {civ.openings.length > 3 && (
          <p className="pt-1 text-[10px] text-muted-foreground/50">
            +{civ.openings.length - 3} more openings
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; map?: string; elo?: string }>;
}) {
  const { mode: modeParam, map: mapParam, elo: eloParam } = await searchParams;
  const mode    = (modeParam ?? "rm-1v1") as GameMode;
  const eloKey  = eloParam ?? "all";

  const provider   = createDataProvider();
  const mapList    = await provider.getStrategyMapList(mode);
  const mapSlug    = mapParam ?? mapList[0] ?? "arabia";
  const stratData  = await provider.getStrategyStats(mode, mapSlug, eloKey);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-orange-400">
          Opening Strategies
        </h1>
        <p className="mt-1 text-muted-foreground">
          Most popular openings per civilization · parsed from ranked replays
        </p>
      </div>

      {COMING_SOON ? (
        <div className="relative">
          {/* Blurred preview skeleton */}
          <div className="pointer-events-none select-none blur-[2px] opacity-30">
            <div className="mb-8 flex flex-wrap items-center gap-4">
              <div className="h-9 w-64 rounded-md bg-muted animate-pulse" />
              <div className="flex gap-1.5">
                {ELO_OPTIONS.map((o) => (
                  <div key={o.key} className="h-7 w-20 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            </div>
            <div className="mb-6 h-52 rounded-xl bg-card border border-border/60 animate-pulse" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-card border border-border/60 animate-pulse" />
              ))}
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-md px-10 py-8 text-center shadow-2xl max-w-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10">
                <Clock className="h-7 w-7 text-orange-400" />
              </div>
              <h2 className="mb-2 text-xl font-bold">Coming Soon</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We&apos;re parsing ranked replays to classify openings like Archer Rush,
                Scout Rush, Drush FC, and Fast Castle. Check back soon.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-2.5">
                <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">Parsing replays daily</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter row */}
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <ModeSelector
              currentMode={mode}
              currentMap={mapSlug}
              currentElo={eloKey}
              mapList={mapList}
            />
            {/* ELO pills */}
            <div className="flex flex-wrap gap-1.5">
              {ELO_OPTIONS.map((opt) =>
                opt.active ? (
                  <a
                    key={opt.key}
                    href={`/strategy?mode=${mode}&map=${mapSlug}&elo=${opt.key}`}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      eloKey === opt.key
                        ? "bg-orange-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt.label}
                  </a>
                ) : (
                  <div key={opt.key} className="group relative">
                    <span className="block rounded-md px-3 py-1.5 text-xs font-medium cursor-not-allowed opacity-35 bg-muted text-muted-foreground select-none">
                      {opt.label}
                    </span>
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover border border-border px-2.5 py-1 text-[11px] text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 z-50">
                      Coming soon — not enough data yet
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {!stratData ? (
            <p className="py-16 text-center text-muted-foreground">
              No strategy data available for this map yet.
            </p>
          ) : (
            <>
              {/* Summary row */}
              <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>
                  Map:{" "}
                  <span className="font-semibold text-orange-400">{stratData.mapName}</span>
                </span>
                <span>·</span>
                <span>
                  Games analyzed:{" "}
                  <span className="font-semibold text-foreground">
                    {stratData.totalGames.toLocaleString()}
                  </span>
                </span>
                <span>·</span>
                <span>Updated: {stratData.updatedAt}</span>
              </div>

              {/* Global opening breakdown */}
              <div className="mb-8">
                <GlobalOpeningCard openings={stratData.globalOpenings} />
              </div>

              {/* Highlight rows: best & worst win-rate openings (min 50 games) */}
              {(() => {
                const qualified = stratData.globalOpenings.filter(
                  (o) => o.games >= 50 && o.opening !== "Other"
                );
                const best  = [...qualified].sort((a, b) => b.winRate - a.winRate).slice(0, 3);
                const worst = [...qualified].sort((a, b) => a.winRate - b.winRate).slice(0, 3);
                if (best.length === 0) return null;
                return (
                  <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card className="border-green-500/20 bg-green-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-green-400">
                          <TrendingUp className="h-4 w-4" />
                          Highest Win-Rate Openings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1">
                        {best.map((o) => (
                          <div key={o.opening} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${openingColor(o.opening)}`} />
                              <span>{o.opening}</span>
                            </div>
                            <span className="font-semibold tabular-nums text-green-400">
                              {o.winRate.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <Card className="border-red-500/20 bg-red-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-red-400">
                          <TrendingDown className="h-4 w-4" />
                          Lowest Win-Rate Openings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1">
                        {worst.map((o) => (
                          <div key={o.opening} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${openingColor(o.opening)}`} />
                              <span>{o.opening}</span>
                            </div>
                            <span className="font-semibold tabular-nums text-red-400">
                              {o.winRate.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* Per-civ grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stratData.civs.map((civ) => (
                  <CivCard key={civ.civName} civ={civ} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
