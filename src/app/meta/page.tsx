import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { TrendingUp, TrendingDown, ArrowRight, BarChart2 } from "lucide-react";
import { createDataProvider } from "@/lib/api/provider";
import { getCivImageUrl } from "@/lib/constants";
import { CivChange, GameMode } from "@/lib/api/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModeSelector } from "./mode-selector";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

// ─── Civ change card ────────────────────────────────────────────────────────

function CivChangeCard({
  civ,
  variant,
}: {
  civ: CivChange;
  variant: "riser" | "faller";
}) {
  const isRiser = variant === "riser";
  const borderColor = isRiser
    ? "rgba(34,197,94,0.30)"
    : "rgba(239,68,68,0.30)";
  const accentColor = isRiser ? "#22c55e" : "#ef4444";
  const bgColor = isRiser ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)";
  const civSlug = civ.civName.toLowerCase().replace(/\s+/g, "_");
  const changeSign = civ.change >= 0 ? "+" : "";
  const rankChangeAbs = Math.abs(civ.rankChange);

  return (
    <Link
      href={`/civ/${civSlug}`}
      className="group relative flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
      style={{ borderColor, background: bgColor }}
    >
      {/* Civ icon */}
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted/50">
        <Image
          src={getCivImageUrl(civ.civName)}
          alt={civ.civName}
          width={44}
          height={44}
          className="h-full w-full object-cover"
          unoptimized
        />
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-foreground">
          {civ.civName}
        </span>

        {/* Change row */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold font-mono"
            style={{ color: accentColor }}
          >
            {changeSign}{civ.change.toFixed(2)}% WR
          </span>
          {civ.rankChange !== 0 && (
            <span
              className="text-xs font-medium"
              style={{ color: accentColor }}
            >
              {isRiser ? "↑" : "↓"}{rankChangeAbs} rank{rankChangeAbs !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* WR progression */}
        <span className="text-xs text-muted-foreground font-mono">
          {civ.previousWinRate.toFixed(1)}%{" "}
          <span className="opacity-50">→</span>{" "}
          <span style={{ color: accentColor }}>{civ.currentWinRate.toFixed(1)}%</span>
        </span>
      </div>

      {/* Current rank badge */}
      <div className="shrink-0 text-right">
        <span className="text-xs text-muted-foreground">rank</span>
        <div
          className="text-sm font-bold font-mono"
          style={{ color: accentColor }}
        >
          #{civ.currentRank}
        </div>
      </div>
    </Link>
  );
}

// ─── Rank change badge ──────────────────────────────────────────────────────

function RankChangeBadge({ rankChange }: { rankChange: number }) {
  if (rankChange === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const isUp = rankChange > 0;
  return (
    <span
      className="text-xs font-mono font-semibold"
      style={{ color: isUp ? "#22c55e" : "#ef4444" }}
    >
      {isUp ? "↑" : "↓"}{Math.abs(rankChange)}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function MetaPage({ searchParams }: PageProps) {
  const { mode: rawMode } = await searchParams;
  const mode = (rawMode || "rm-1v1") as GameMode;

  const provider = createDataProvider();
  const report = await provider.getMetaReport(mode);

  const { biggestRisers, biggestFallers, allChanges } = report;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
            <BarChart2 className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Meta Report</h1>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          What changed between patches{" "}
          <span className="font-mono font-medium text-foreground">
            {report.previousPatchLabel}
          </span>{" "}
          and{" "}
          <span className="font-mono font-medium text-foreground">
            {report.currentPatchLabel}
          </span>
        </p>

        {/* Mode selector */}
        <Suspense
          fallback={
            <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
          }
        >
          <ModeSelector currentMode={mode} />
        </Suspense>
      </div>

      {/* ── Patch comparison badge ──────────────────────────────────────── */}
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm shadow-sm">
        <span className="font-mono text-muted-foreground">
          {report.previousPatchLabel}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-orange-400 shrink-0" />
        <span className="font-mono font-semibold text-foreground">
          {report.currentPatchLabel}
        </span>
        <span className="ml-1 text-xs text-muted-foreground">
          · {allChanges.length} civs tracked
        </span>
      </div>

      {/* ── Risers & Fallers columns ────────────────────────────────────── */}
      {allChanges.length > 0 ? (
        <>
          <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Biggest Risers */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" style={{ color: "#22c55e" }} />
                <h2 className="text-lg font-semibold">Biggest Risers</h2>
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400 ring-1 ring-green-500/20">
                  Top 8
                </span>
              </div>
              <div className="space-y-2">
                {biggestRisers.map((civ) => (
                  <CivChangeCard key={civ.civName} civ={civ} variant="riser" />
                ))}
                {biggestRisers.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No data available.
                  </p>
                )}
              </div>
            </div>

            {/* Biggest Fallers */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <TrendingDown
                  className="h-5 w-5"
                  style={{ color: "#ef4444" }}
                />
                <h2 className="text-lg font-semibold">Biggest Fallers</h2>
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">
                  Bottom 8
                </span>
              </div>
              <div className="space-y-2">
                {biggestFallers.map((civ) => (
                  <CivChangeCard key={civ.civName} civ={civ} variant="faller" />
                ))}
                {biggestFallers.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No data available.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Full table ─────────────────────────────────────────────────── */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">All Civilizations</h2>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-12 text-center text-xs">#</TableHead>
                    <TableHead className="text-xs">Civilization</TableHead>
                    <TableHead className="text-right text-xs">Win Rate</TableHead>
                    <TableHead className="text-right text-xs">Change</TableHead>
                    <TableHead className="text-right text-xs">Prev WR</TableHead>
                    <TableHead className="text-right text-xs">Rank</TableHead>
                    <TableHead className="text-right text-xs">Rank Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allChanges.map((civ, idx) => {
                    const civSlug = civ.civName
                      .toLowerCase()
                      .replace(/\s+/g, "_");
                    const changeSign = civ.change >= 0 ? "+" : "";
                    const changeColor =
                      civ.change > 0
                        ? "#22c55e"
                        : civ.change < 0
                        ? "#ef4444"
                        : undefined;

                    return (
                      <TableRow
                        key={civ.civName}
                        className="border-border/40 hover:bg-muted/20"
                      >
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/civ/${civSlug}`}
                            className="flex items-center gap-2.5 hover:text-orange-400 transition-colors"
                          >
                            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded bg-muted/50">
                              <Image
                                src={getCivImageUrl(civ.civName)}
                                alt={civ.civName}
                                width={28}
                                height={28}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {civ.civName}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {civ.currentWinRate.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          <span style={{ color: changeColor }}>
                            {changeSign}{civ.change.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {civ.previousWinRate.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          #{civ.currentRank}
                        </TableCell>
                        <TableCell className="text-right">
                          <RankChangeBadge rankChange={civ.rankChange} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-20 text-center">
          <BarChart2 className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="text-base font-medium text-muted-foreground">
            No patch comparison data available yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Check back after the next patch is tracked.
          </p>
        </div>
      )}
    </div>
  );
}
