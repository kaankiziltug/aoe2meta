"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, User, Loader2, X, BadgeCheck, Swords, Trophy, Shield, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerProfile, Player, GameMode } from "@/lib/api/types";
import { getCountryFlag, GAME_MODES, getCivImageUrl } from "@/lib/constants";
import { getRankTier } from "@/lib/rank";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// PlayerSearch — inline search box with dropdown
// ─────────────────────────────────────────────────────────────────────────────

interface PlayerSearchProps {
  label: string;
  selected: PlayerProfile | null;
  loading: boolean;
  onSelect: (player: Player) => void;
  onClear: () => void;
  align?: "left" | "right";
}

function PlayerSearch({
  label,
  selected,
  loading,
  onSelect,
  onClear,
  align = "left",
}: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (player: Player) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect(player);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <p
        className={cn(
          "mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground",
          align === "right" && "text-right"
        )}
      >
        {label}
      </p>

      {/* Selected player chip */}
      {selected && !loading && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2",
            align === "right" && "flex-row-reverse"
          )}
        >
          {selected.avatarUrl ? (
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-primary/20">
              <Image
                src={selected.avatarUrl}
                alt={selected.name}
                width={32}
                height={32}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
          )}
          <div className={cn("flex flex-1 flex-col min-w-0", align === "right" && "items-end")}>
            <div
              className={cn(
                "flex items-center gap-1 min-w-0",
                align === "right" && "flex-row-reverse"
              )}
            >
              <span className="truncate text-sm font-semibold">{selected.name}</span>
              {selected.verified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </div>
            {selected.country && (
              <span className="text-xs text-muted-foreground">
                {getCountryFlag(selected.country)} {selected.country}
              </span>
            )}
          </div>
          <button
            onClick={onClear}
            className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Loading chip */}
      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading profile…</span>
        </div>
      )}

      {/* Search input (hidden when player is selected or loading) */}
      {!selected && !loading && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player name…"
            className="pl-9 pr-9"
          />
          {query && !searching && (
            <button
              onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border/60 bg-background shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-1.5">
            {results.slice(0, 8).map((player) => (
              <button
                key={player.profileId}
                onClick={() => handleSelect(player)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex flex-1 items-center gap-2 min-w-0">
                  {player.country && (
                    <span className="text-base leading-none">{getCountryFlag(player.country)}</span>
                  )}
                  <span className="font-medium truncate">{player.name}</span>
                  {player.clan && (
                    <span className="text-xs text-muted-foreground shrink-0">[{player.clan}]</span>
                  )}
                </span>
                {player.ratings?.["rm-1v1"] && (
                  <span className="font-mono text-sm text-primary shrink-0">
                    {player.ratings["rm-1v1"]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && !searching && query.length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border/60 bg-background shadow-xl">
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <User className="mb-2 h-6 w-6 opacity-30" />
            <p className="text-sm">No players found</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RankBadge
// ─────────────────────────────────────────────────────────────────────────────

function RankBadge({ elo }: { elo: number }) {
  const tier = getRankTier(elo);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tier.bgColor,
        tier.color
      )}
    >
      {tier.emoji} {tier.name}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayerHeader — avatar + name + country + badges
// ─────────────────────────────────────────────────────────────────────────────

interface PlayerHeaderProps {
  profile: PlayerProfile;
  align?: "left" | "right";
  highlight?: boolean;
}

function PlayerHeader({ profile, align = "left", highlight }: PlayerHeaderProps) {
  const rm1v1 = profile.ratings?.["rm-1v1"] ?? 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "right" ? "items-end text-right" : "items-start text-left"
      )}
    >
      {/* Avatar */}
      {profile.avatarUrl ? (
        <div
          className={cn(
            "h-16 w-16 overflow-hidden rounded-2xl ring-2",
            highlight ? "ring-[#f97316]/60" : "ring-primary/20"
          )}
        >
          <Image
            src={profile.avatarUrl}
            alt={profile.name}
            width={64}
            height={64}
            className="h-full w-full object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl ring-2",
            highlight
              ? "bg-[#f97316]/10 text-[#f97316] ring-[#f97316]/30"
              : "bg-primary/10 text-primary ring-primary/20"
          )}
        >
          <User className="h-7 w-7" />
        </div>
      )}

      {/* Name + verified */}
      <div className={cn("flex items-center gap-1.5", align === "right" && "flex-row-reverse")}>
        <Link
          href={`/player/${profile.profileId}`}
          className="text-lg font-bold hover:text-primary transition-colors"
        >
          {profile.name}
        </Link>
        {profile.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
      </div>

      {/* Country */}
      {profile.country && (
        <span className="text-sm text-muted-foreground">
          {getCountryFlag(profile.country)} {profile.country}
        </span>
      )}

      {/* Rank badge */}
      {rm1v1 > 0 && <RankBadge elo={rm1v1} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type WinnerSide = "left" | "right" | "tie";

function winnerClass(side: "left" | "right", winner: WinnerSide) {
  if (winner === "tie") return "";
  if (winner === side)
    return "font-bold text-[#f97316]";
  return "text-muted-foreground";
}

function winnerIcon(side: "left" | "right", winner: WinnerSide) {
  if (winner === "tie") return null;
  if (winner === side) return " 🏆";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ComparisonTable
// ─────────────────────────────────────────────────────────────────────────────

interface ComparisonTableProps {
  p1: PlayerProfile;
  p2: PlayerProfile;
}

function ComparisonTable({ p1, p2 }: ComparisonTableProps) {
  const rows: {
    label: string;
    v1: string;
    v2: string;
    winner: WinnerSide;
  }[] = [];

  // RM 1v1
  const rm1v1_1 = p1.ratings?.["rm-1v1"];
  const rm1v1_2 = p2.ratings?.["rm-1v1"];
  if (rm1v1_1 !== undefined && rm1v1_2 !== undefined) {
    rows.push({
      label: "RM 1v1 Rating",
      v1: rm1v1_1.toLocaleString(),
      v2: rm1v1_2.toLocaleString(),
      winner:
        rm1v1_1 > rm1v1_2 ? "left" : rm1v1_2 > rm1v1_1 ? "right" : "tie",
    });
  }

  // Other shared modes
  const otherModes: { id: GameMode; label: string }[] = [
    { id: "rm-team", label: "RM Team Rating" },
    { id: "ew-1v1", label: "EW 1v1 Rating" },
    { id: "ew-team", label: "EW Team Rating" },
    { id: "dm-1v1", label: "DM 1v1 Rating" },
    { id: "dm-team", label: "DM Team Rating" },
    { id: "ror-1v1", label: "RoR 1v1 Rating" },
    { id: "ror-team", label: "RoR Team Rating" },
  ];

  for (const mode of otherModes) {
    const r1 = p1.ratings?.[mode.id];
    const r2 = p2.ratings?.[mode.id];
    if (r1 !== undefined && r2 !== undefined) {
      rows.push({
        label: mode.label,
        v1: r1.toLocaleString(),
        v2: r2.toLocaleString(),
        winner: r1 > r2 ? "left" : r2 > r1 ? "right" : "tie",
      });
    }
  }

  // Win rate
  const wr1 = p1.totalGames > 0 ? (p1.totalWins / p1.totalGames) * 100 : 0;
  const wr2 = p2.totalGames > 0 ? (p2.totalWins / p2.totalGames) * 100 : 0;
  rows.push({
    label: "Win Rate",
    v1: `${wr1.toFixed(1)}%`,
    v2: `${wr2.toFixed(1)}%`,
    winner: wr1 > wr2 ? "left" : wr2 > wr1 ? "right" : "tie",
  });

  // Total games
  rows.push({
    label: "Total Games",
    v1: p1.totalGames.toLocaleString(),
    v2: p2.totalGames.toLocaleString(),
    winner:
      p1.totalGames > p2.totalGames
        ? "left"
        : p2.totalGames > p1.totalGames
        ? "right"
        : "tie",
  });

  // Total wins
  rows.push({
    label: "Total Wins",
    v1: p1.totalWins.toLocaleString(),
    v2: p2.totalWins.toLocaleString(),
    winner:
      p1.totalWins > p2.totalWins
        ? "left"
        : p2.totalWins > p1.totalWins
        ? "right"
        : "tie",
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-[#f97316]" />
          Stats Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className={cn(
                    "border-b border-border/30 last:border-0",
                    i % 2 === 0 ? "bg-muted/10" : ""
                  )}
                >
                  {/* Player 1 value */}
                  <td
                    className={cn(
                      "w-[36%] px-4 py-3 text-right font-mono",
                      winnerClass("left", row.winner)
                    )}
                  >
                    {row.v1}
                    {winnerIcon("left", row.winner)}
                  </td>

                  {/* Label */}
                  <td className="w-[28%] px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </td>

                  {/* Player 2 value */}
                  <td
                    className={cn(
                      "w-[36%] px-4 py-3 text-left font-mono",
                      winnerClass("right", row.winner)
                    )}
                  >
                    {winnerIcon("right", row.winner)}
                    {row.v2}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BestCivsComparison
// ─────────────────────────────────────────────────────────────────────────────

interface BestCivsComparisonProps {
  p1: PlayerProfile;
  p2: PlayerProfile;
}

function BestCivsComparison({ p1, p2 }: BestCivsComparisonProps) {
  const top1 = p1.bestCivs.slice(0, 3);
  const top2 = p2.bestCivs.slice(0, 3);
  const rows = Math.max(top1.length, top2.length);

  if (rows === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-[#f97316]" />
          Best Civilizations
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: rows }).map((_, i) => {
              const c1 = top1[i];
              const c2 = top2[i];
              return (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border/30 last:border-0",
                    i % 2 === 0 ? "bg-muted/10" : ""
                  )}
                >
                  {/* Player 1 civ */}
                  <td className="w-1/2 px-4 py-3">
                    {c1 ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex flex-col items-end">
                          <span className="font-medium">{c1.civName}</span>
                          <span className="text-xs text-muted-foreground">
                            {c1.winRate.toFixed(0)}% · {c1.games}g
                          </span>
                        </div>
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded">
                          <Image
                            src={getCivImageUrl(c1.civName)}
                            alt={c1.civName}
                            width={32}
                            height={32}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="block text-right text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Divider */}
                  <td className="w-0 px-0">
                    <div className="mx-auto h-full w-px bg-border/40" />
                  </td>

                  {/* Player 2 civ */}
                  <td className="w-1/2 px-4 py-3">
                    {c2 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded">
                          <Image
                            src={getCivImageUrl(c2.civName)}
                            alt={c2.civName}
                            width={32}
                            height={32}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        </div>
                        <div>
                          <span className="font-medium">{c2.civName}</span>
                          <p className="text-xs text-muted-foreground">
                            {c2.winRate.toFixed(0)}% · {c2.games}g
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BestMapsComparison
// ─────────────────────────────────────────────────────────────────────────────

interface BestMapsComparisonProps {
  p1: PlayerProfile;
  p2: PlayerProfile;
}

function BestMapsComparison({ p1, p2 }: BestMapsComparisonProps) {
  const top1 = p1.bestMaps.slice(0, 3);
  const top2 = p2.bestMaps.slice(0, 3);
  const rows = Math.max(top1.length, top2.length);

  if (rows === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-[#f97316]" />
          Best Maps
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: rows }).map((_, i) => {
              const m1 = top1[i];
              const m2 = top2[i];
              return (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border/30 last:border-0",
                    i % 2 === 0 ? "bg-muted/10" : ""
                  )}
                >
                  {/* Player 1 map */}
                  <td className="w-1/2 px-4 py-3 text-right">
                    {m1 ? (
                      <div>
                        <span className="font-medium">{m1.mapName}</span>
                        <p className="text-xs text-muted-foreground">
                          {m1.winRate.toFixed(0)}% · {m1.games}g
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Divider */}
                  <td className="w-0 px-0">
                    <div className="mx-auto h-full w-px bg-border/40" />
                  </td>

                  {/* Player 2 map */}
                  <td className="w-1/2 px-4 py-3">
                    {m2 ? (
                      <div>
                        <span className="font-medium">{m2.mapName}</span>
                        <p className="text-xs text-muted-foreground">
                          {m2.winRate.toFixed(0)}% · {m2.games}g
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [p1Profile, setP1Profile] = useState<PlayerProfile | null>(null);
  const [p2Profile, setP2Profile] = useState<PlayerProfile | null>(null);
  const [p1Loading, setP1Loading] = useState(false);
  const [p2Loading, setP2Loading] = useState(false);

  const fetchProfile = async (
    profileId: number,
    setProfile: (p: PlayerProfile | null) => void,
    setLoading: (v: boolean) => void
  ) => {
    setLoading(true);
    setProfile(null);
    try {
      const res = await fetch(`/api/player/${profileId}`);
      const data = await res.json();
      setProfile(data?.error ? null : data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectP1 = (player: Player) => {
    fetchProfile(player.profileId, setP1Profile, setP1Loading);
  };

  const handleSelectP2 = (player: Player) => {
    fetchProfile(player.profileId, setP2Profile, setP2Loading);
  };

  const bothLoaded = p1Profile && p2Profile;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Page title */}
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-3 text-3xl font-bold">
          <Swords className="h-7 w-7 text-[#f97316]" />
          Player Comparison
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Search two players to compare their stats head-to-head
        </p>
      </div>

      {/* Search row */}
      <Card className="border-border/50 overflow-visible">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Player 1 search */}
            <PlayerSearch
              label="Player 1"
              selected={p1Profile}
              loading={p1Loading}
              onSelect={handleSelectP1}
              onClear={() => setP1Profile(null)}
              align="left"
            />

            {/* VS divider */}
            <div className="flex shrink-0 items-center justify-center sm:mt-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-muted/50">
                <span className="text-xs font-bold text-muted-foreground">VS</span>
              </div>
            </div>

            {/* Player 2 search */}
            <PlayerSearch
              label="Player 2"
              selected={p2Profile}
              loading={p2Loading}
              onSelect={handleSelectP2}
              onClear={() => setP2Profile(null)}
              align="right"
            />
          </div>
        </CardContent>
      </Card>

      {/* Loading skeletons */}
      {(p1Loading || p2Loading) && !bothLoaded && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Comparison sections */}
      {bothLoaded && (
        <div className="space-y-6">
          {/* Header: both players side by side */}
          <Card className="border-border/50 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary/40 via-[#f97316] to-primary/40" />
            <CardContent className="pt-6 pb-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                <PlayerHeader profile={p1Profile} align="left" highlight />

                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#f97316]/40 bg-[#f97316]/10">
                    <Swords className="h-5 w-5 text-[#f97316]" />
                  </div>
                  <span className="text-xs font-bold tracking-widest text-muted-foreground">
                    VS
                  </span>
                </div>

                <div className="flex justify-end">
                  <PlayerHeader profile={p2Profile} align="right" highlight />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats table */}
          <ComparisonTable p1={p1Profile} p2={p2Profile} />

          {/* Best civs */}
          {(p1Profile.bestCivs.length > 0 || p2Profile.bestCivs.length > 0) && (
            <BestCivsComparison p1={p1Profile} p2={p2Profile} />
          )}

          {/* Best maps */}
          {(p1Profile.bestMaps.length > 0 || p2Profile.bestMaps.length > 0) && (
            <BestMapsComparison p1={p1Profile} p2={p2Profile} />
          )}
        </div>
      )}

      {/* Prompt when neither player is selected */}
      {!p1Profile && !p2Profile && !p1Loading && !p2Loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Swords className="mb-4 h-14 w-14 opacity-20" />
          <p className="text-base font-medium">Select two players to begin</p>
          <p className="mt-1 text-sm opacity-70">
            Use the search boxes above to find and compare AoE2 players
          </p>
        </div>
      )}
    </div>
  );
}
