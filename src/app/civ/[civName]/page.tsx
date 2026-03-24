import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Swords, ArrowLeft, Clock, Shield, Zap, TrendingUp } from "lucide-react";
import { createDataProvider } from "@/lib/api/provider";
import { getCivImageUrl } from "@/lib/constants";
import { CivDetail, CivMatchupStat, CivMapStat, CivEloBreakdown, CivPatchPoint, GameMode } from "@/lib/api/types";
import { ModeSelector } from "./mode-selector";
import { EloChart } from "./elo-chart";
import { PatchChart } from "./patch-chart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ civName: string }>;
}): Promise<Metadata> {
  const { civName } = await params;
  const name = civName.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    title: `${name} — Civilization Stats`,
    description: `Age of Empires II ${name} civilization statistics. Win rate by ELO, best maps, matchup analysis, and more.`,
    alternates: { canonical: `https://aoe2meta.com/civ/${civName}` },
    openGraph: {
      title: `${name} Civilization Stats — AoE2Meta`,
      description: `Complete ${name} civ analysis: win rates, best maps, strengths and weaknesses.`,
      url: `https://aoe2meta.com/civ/${civName}`,
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function secondsToMMSS(secs: number): string {
  if (!secs || secs <= 0) return "–";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function WinRateBar({ rate }: { rate: number }) {
  const color =
    rate >= 52
      ? "bg-green-500"
      : rate >= 50
      ? "bg-orange-400"
      : rate >= 48
      ? "bg-orange-500"
      : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(rate * 1.5, 100)}%` }}
        />
      </div>
      <span
        className={`text-sm font-medium ${
          rate >= 50 ? "text-green-400" : "text-red-400"
        }`}
      >
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function WinRateBadge({ rate }: { rate: number }) {
  const cls =
    rate >= 52
      ? "border-green-500/30 text-green-400 bg-green-500/10"
      : rate >= 50
      ? "border-orange-400/30 text-orange-400 bg-orange-400/10"
      : rate >= 48
      ? "border-orange-500/30 text-orange-500 bg-orange-500/10"
      : "border-red-500/30 text-red-400 bg-red-500/10";
  return (
    <Badge variant="outline" className={`font-mono text-base px-3 py-1 ${cls}`}>
      {rate.toFixed(1)}%
    </Badge>
  );
}

// ── ELO Chart (client component) ─────────────────────────────────────────────
// Recharts requires client environment; extracted separately via mode-selector file

// ── Map row ──────────────────────────────────────────────────────────────────
function MapRow({ map }: { map: CivMapStat }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-medium text-foreground/90 min-w-[120px]">
        {map.mapName}
      </span>
      <div className="flex items-center gap-3 flex-1 justify-end">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {map.numGames.toLocaleString()} games
        </span>
        <WinRateBar rate={map.winRate} />
      </div>
    </div>
  );
}

// ── Matchup row ───────────────────────────────────────────────────────────────
function MatchupRow({ matchup }: { matchup: CivMatchupStat }) {
  const slug = matchup.civName.toLowerCase().replace(/\s+/g, "_");
  return (
    <Link
      href={`/civ/${slug}`}
      className="flex items-center gap-3 py-2 rounded-lg hover:bg-accent/30 transition-colors px-2 -mx-2"
    >
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded">
        <Image
          src={getCivImageUrl(matchup.civName)}
          alt={matchup.civName}
          width={28}
          height={28}
          className="h-full w-full object-cover"
          unoptimized
        />
      </div>
      <span className="flex-1 text-sm font-medium">{matchup.civName}</span>
      <WinRateBar rate={matchup.winRate} />
    </Link>
  );
}

// ── ELO breakdown table row ───────────────────────────────────────────────────
function EloRow({ elo }: { elo: CivEloBreakdown }) {
  const winColor =
    elo.winRate >= 52
      ? "text-green-400"
      : elo.winRate >= 50
      ? "text-orange-400"
      : elo.winRate >= 48
      ? "text-orange-500"
      : "text-red-400";
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium w-24">{elo.eloLabel}</span>
        {elo.rank > 0 && (
          <Badge variant="outline" className="text-xs text-muted-foreground border-border/40">
            #{elo.rank}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {elo.numGames.toLocaleString()}g
        </span>
        <span className={`font-mono text-sm font-semibold ${winColor}`}>
          {elo.winRate > 0 ? `${elo.winRate.toFixed(1)}%` : "–"}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ civName: string }>;
  searchParams: Promise<{ mode?: string }>;
}

export default async function CivPage({ params, searchParams }: PageProps) {
  const { civName } = await params;
  const { mode: modeParam } = await searchParams;
  const mode = (modeParam ?? "rm-1v1") as GameMode;

  const provider = createDataProvider();
  const [detail, patchHistory]: [CivDetail | null, CivPatchPoint[]] = await Promise.all([
    provider.getCivDetail(civName, mode),
    provider.getCivPatchHistory(civName, mode),
  ]);

  if (!detail) notFound();

  const winRateColor =
    detail.winRate >= 52
      ? "text-green-400"
      : detail.winRate >= 50
      ? "text-orange-400"
      : detail.winRate >= 48
      ? "text-orange-500"
      : "text-red-400";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/stats"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Civilization Stats
      </Link>

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Civ icon */}
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
          <Image
            src={getCivImageUrl(detail.civName)}
            alt={detail.civName}
            width={112}
            height={112}
            className="h-full w-full object-cover"
            unoptimized
          />
        </div>

        {/* Name + stats */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold tracking-tight">{detail.civName}</h1>
            <Badge
              variant="outline"
              className="border-orange-400/30 text-orange-400 bg-orange-400/10 text-sm px-2.5 py-0.5"
            >
              <Trophy className="mr-1 h-3.5 w-3.5" />
              Rank #{detail.rank}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-6 mt-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Win Rate</p>
              <p className={`text-2xl font-bold font-mono ${winRateColor}`}>
                {detail.winRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pick Rate</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {detail.playRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Games</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {detail.totalGames.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Mode selector (client component) */}
        <ModeSelector currentMode={mode} civSlug={civName} />
      </div>

      {/* ── Main Grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left column (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">

          {/* ELO Breakdown Chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-orange-400" />
                Win Rate by ELO Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EloChart eloBreakdown={detail.eloBreakdown} />
              <div className="mt-4 space-y-0.5">
                {detail.eloBreakdown.map((e) => (
                  <EloRow key={e.elo} elo={e} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Win Rate History */}
          {patchHistory.length >= 2 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-orange-400" />
                  Win Rate History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PatchChart data={patchHistory} />
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>Last {patchHistory.length} patches</span>
                  <span>
                    {patchHistory[0]?.winRate.toFixed(1)}% → {patchHistory[patchHistory.length - 1]?.winRate.toFixed(1)}%
                    {patchHistory[patchHistory.length - 1]?.winRate > patchHistory[0]?.winRate
                      ? " ↑" : " ↓"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Maps */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-green-400" />
                  Best Maps
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.topMaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No map data available</p>
                ) : (
                  <div className="divide-y divide-border/20">
                    {detail.topMaps.map((map) => (
                      <MapRow key={map.mapName} map={map} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-red-400" />
                  Worst Maps
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.bottomMaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No map data available</p>
                ) : (
                  <div className="divide-y divide-border/20">
                    {detail.bottomMaps.map((map) => (
                      <MapRow key={map.mapName} map={map} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Matchups */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Swords className="h-4 w-4 text-green-400" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.bestMatchups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matchup data available</p>
                ) : (
                  <div>
                    {detail.bestMatchups.map((m) => (
                      <MatchupRow key={m.civName} matchup={m} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Swords className="h-4 w-4 text-red-400" />
                  Weaknesses
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.worstMatchups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matchup data available</p>
                ) : (
                  <div>
                    {detail.worstMatchups.map((m) => (
                      <MatchupRow key={m.civName} matchup={m} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right column (1/3 width) */}
        <div className="space-y-6">

          {/* Game Length Analysis */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-orange-400" />
                Game Length Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.byGameLength.length === 0 ? (
                <p className="text-sm text-muted-foreground">No game length data available</p>
              ) : (
                <div className="space-y-4">
                  {detail.byGameLength.map((g) => (
                    <div key={g.label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{g.label}</span>
                        <WinRateBadge rate={g.winRate} />
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all ${
                            g.winRate >= 52
                              ? "bg-green-500"
                              : g.winRate >= 50
                              ? "bg-orange-400"
                              : g.winRate >= 48
                              ? "bg-orange-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(((g.winRate - 44) / 16) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {g.numGames.toLocaleString()} games
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Average Timings */}
          {(detail.avgFeudalTime > 0 ||
            detail.avgCastleTime > 0 ||
            detail.avgImperialTime > 0) && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-orange-400" />
                  Average Timings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {detail.avgFeudalTime > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Feudal Age</span>
                      <span className="font-mono text-sm font-semibold text-orange-400">
                        {secondsToMMSS(detail.avgFeudalTime)}
                      </span>
                    </div>
                  )}
                  {detail.avgCastleTime > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Castle Age</span>
                      <span className="font-mono text-sm font-semibold text-orange-400">
                        {secondsToMMSS(detail.avgCastleTime)}
                      </span>
                    </div>
                  )}
                  {detail.avgImperialTime > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Imperial Age</span>
                      <span className="font-mono text-sm font-semibold text-orange-400">
                        {secondsToMMSS(detail.avgImperialTime)}
                      </span>
                    </div>
                  )}
                  {detail.avgGameLength > 0 && (
                    <div className="flex items-center justify-between border-t border-border/30 pt-3 mt-3">
                      <span className="text-sm text-muted-foreground">Avg Game Length</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {secondsToMMSS(detail.avgGameLength)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick stats summary card */}
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Overall Rank</span>
                  <Badge variant="outline" className="border-orange-400/30 text-orange-400">
                    #{detail.rank}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <span className={`font-mono text-sm font-semibold ${winRateColor}`}>
                    {detail.winRate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pick Rate</span>
                  <span className="font-mono text-sm font-semibold">
                    {detail.playRate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Games</span>
                  <span className="font-mono text-sm font-semibold">
                    {detail.totalGames.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
