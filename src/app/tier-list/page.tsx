import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { Suspense } from "react";
import { createDataProvider } from "@/lib/api/provider";
import { getCivImageUrl } from "@/lib/constants";
import { CivStats, GameMode } from "@/lib/api/types";
import { ModeSelector } from "./mode-selector";
import { ListFilter } from "lucide-react";

export const metadata: Metadata = {
  title: "Civilization Tier List",
  description:
    "Age of Empires II civilization tier list based on current patch win rates. S, A, B, C, D tier rankings for all civs.",
  alternates: { canonical: "https://aoe2meta.com/tier-list" },
  openGraph: {
    title: "AoE2 Civilization Tier List — AoE2Meta",
    description:
      "Age of Empires II civilization tier list based on current patch win rates. S, A, B, C, D tier rankings for all civs.",
    url: "https://aoe2meta.com/tier-list",
  },
};

interface Tier {
  label: string;
  minWinRate: number;
  color: string;
  bg: string;
  borderColor: string;
}

const TIERS: Tier[] = [
  {
    label: "S",
    minWinRate: 52.5,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.25)",
  },
  {
    label: "A",
    minWinRate: 51.5,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.25)",
  },
  {
    label: "B",
    minWinRate: 50.0,
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    borderColor: "rgba(59,130,246,0.25)",
  },
  {
    label: "C",
    minWinRate: 48.5,
    color: "#a855f7",
    bg: "rgba(168,85,247,0.10)",
    borderColor: "rgba(168,85,247,0.25)",
  },
  {
    label: "D",
    minWinRate: -Infinity,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.25)",
  },
];

function getTier(winRate: number): Tier {
  for (const tier of TIERS) {
    if (winRate >= tier.minWinRate) return tier;
  }
  return TIERS[TIERS.length - 1];
}

function groupByTier(civs: CivStats[]): { tier: Tier; civs: CivStats[] }[] {
  const sorted = [...civs].sort((a, b) => b.winRate - a.winRate);
  return TIERS.map((tier) => ({
    tier,
    civs: sorted.filter((c) => getTier(c.winRate).label === tier.label),
  })).filter((g) => g.civs.length > 0);
}

function CivCard({ civ }: { civ: CivStats }) {
  const slug = civ.civName.toLowerCase().replace(/\s+/g, "_");
  const tier = getTier(civ.winRate);

  return (
    <Link
      href={`/civ/${slug}`}
      className="group relative flex flex-col items-center gap-1 rounded-lg p-2 transition-all duration-200 hover:scale-105 hover:z-10"
      style={{
        width: "80px",
        minWidth: "80px",
      }}
    >
      {/* Hover glow overlay */}
      <span
        className="pointer-events-none absolute inset-0 rounded-lg opacity-0 ring-1 ring-orange-400/70 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          boxShadow: "0 0 10px 2px rgba(249,115,22,0.35)",
        }}
        aria-hidden="true"
      />

      {/* Civ icon */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted/50">
        <Image
          src={getCivImageUrl(civ.civName)}
          alt={civ.civName}
          width={48}
          height={48}
          className="h-full w-full object-cover"
          unoptimized
        />
      </div>

      {/* Civ name */}
      <span
        className="w-full text-center font-medium leading-tight text-foreground/90"
        style={{ fontSize: "10px" }}
      >
        {civ.civName}
      </span>

      {/* Win rate */}
      <span
        className="font-mono font-semibold"
        style={{ fontSize: "10px", color: tier.color }}
      >
        {civ.winRate.toFixed(1)}%
      </span>
    </Link>
  );
}

function TierRow({ tier, civs }: { tier: Tier; civs: CivStats[] }) {
  return (
    <div
      className="flex min-h-[96px] w-full overflow-hidden rounded-xl border"
      style={{
        borderColor: tier.borderColor,
        background: "hsl(var(--card))",
      }}
    >
      {/* Tier badge column */}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: "64px",
          minWidth: "64px",
          background: tier.bg,
          borderRight: `1px solid ${tier.borderColor}`,
        }}
      >
        <span
          className="select-none font-extrabold leading-none tracking-tight"
          style={{ fontSize: "48px", color: tier.color, lineHeight: 1 }}
        >
          {tier.label}
        </span>
      </div>

      {/* Civ cards — horizontally scrollable */}
      <div className="flex flex-1 flex-nowrap items-center gap-1 overflow-x-auto px-3 py-2 scrollbar-thin">
        {civs.map((civ) => (
          <CivCard key={civ.civName} civ={civ} />
        ))}
        {civs.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            No civilizations in this tier
          </span>
        )}
      </div>
    </div>
  );
}

const ELO_RANGE_MAP: Record<string, [number, number] | undefined> = {
  "all":       undefined,
  "1000-1400": [1000, 1400],
  "1400-1800": [1400, 1800],
  "1800+":     [1800, 9999],
  "2000+":     [2000, 9999],
};

interface PageProps {
  searchParams: Promise<{ mode?: string; elo?: string }>;
}

export const dynamic = "force-dynamic";

export default async function TierListPage({ searchParams }: PageProps) {
  const { mode: rawMode, elo: rawElo } = await searchParams;
  const mode = (rawMode || "rm-1v1") as GameMode;
  const eloKey = rawElo && rawElo in ELO_RANGE_MAP ? rawElo : "all";
  const eloRange = ELO_RANGE_MAP[eloKey];

  const provider = createDataProvider();
  const stats = await provider.getCivStats(mode, eloRange);
  const groups = groupByTier(stats);

  const totalGames = stats.reduce((sum, s) => sum + s.totalGames, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
            <ListFilter className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Civilization Tier List
          </h1>
        </div>
        <p className="text-muted-foreground text-sm mb-5">
          Rankings based on win rates across{" "}
          <span className="font-mono font-medium text-foreground">
            {totalGames.toLocaleString()}
          </span>{" "}
          ranked games from the last 30 days. Updated daily from live match data.
        </p>

        {/* Mode selector */}
        <Suspense
          fallback={
            <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
          }
        >
          <ModeSelector currentMode={mode} currentElo={eloKey} />
        </Suspense>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {TIERS.map((tier) => (
          <div key={tier.label} className="flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-bold text-xs"
              style={{
                background: tier.bg,
                color: tier.color,
                border: `1px solid ${tier.borderColor}`,
              }}
            >
              {tier.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {tier.label === "S" && "≥ 52.5%"}
              {tier.label === "A" && "≥ 51.5%"}
              {tier.label === "B" && "≥ 50.0%"}
              {tier.label === "C" && "≥ 48.5%"}
              {tier.label === "D" && "< 48.5%"}
            </span>
          </div>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {stats.length} civilizations ranked
        </span>
      </div>

      {/* Tier rows */}
      <div className="space-y-3">
        {TIERS.map((tier) => {
          const group = groups.find((g) => g.tier.label === tier.label);
          if (!group) return null;
          return (
            <TierRow key={tier.label} tier={tier} civs={group.civs} />
          );
        })}
      </div>

      {/* Footer note */}
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Win rates are calculated from ranked multiplayer games. Higher Elo games may vary.{" "}
        <Link
          href="/stats"
          className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
        >
          View full statistics table →
        </Link>
      </p>
    </div>
  );
}
