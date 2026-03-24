"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  Trophy,
  TrendingDown,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { CivStats, GameMode } from "@/lib/api/types";
import { GAME_MODES, getCivImageUrl } from "@/lib/constants";

const ELO_RANGES = [
  { label: "All Elo", value: "all" },
  { label: "0 - 1000", value: "0-1000" },
  { label: "1000 - 1200", value: "1000-1200" },
  { label: "1200 - 1400", value: "1200-1400" },
  { label: "1400 - 1600", value: "1400-1600" },
  { label: "1600 - 1800", value: "1600-1800" },
  { label: "1800 - 2000", value: "1800-2000" },
  { label: "2000+", value: "2000-4000" },
];

type SortKey = "winRate" | "playRate" | "civName" | "totalGames";

export default function StatsPage() {
  const [mode, setMode] = useState<GameMode>("rm-1v1");
  const [eloRange, setEloRange] = useState("all");
  const [stats, setStats] = useState<CivStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("winRate");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setLoading(true);
    let url = `/api/stats?mode=${mode}`;
    if (eloRange !== "all") {
      const [min, max] = eloRange.split("-");
      url += `&eloMin=${min}&eloMax=${max}`;
    }
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, [mode, eloRange]);

  const sorted = [...stats].sort((a, b) => {
    const mul = sortAsc ? 1 : -1;
    if (sortKey === "civName") return mul * a.civName.localeCompare(b.civName);
    return mul * (a[sortKey] - b[sortKey]);
  });

  const top5 = [...stats].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
  const bottom5 = [...stats].sort((a, b) => a.winRate - b.winRate).slice(0, 5);
  const avgWinRate = stats.length > 0 ? stats.reduce((sum, s) => sum + s.winRate, 0) / stats.length : 50;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "civName");
    }
  };

  function WinRateBar({ rate }: { rate: number }) {
    const color =
      rate >= 53
        ? "bg-win"
        : rate >= 51
          ? "bg-win/60"
          : rate <= 47
            ? "bg-loss"
            : rate <= 49
              ? "bg-loss/60"
              : "bg-muted-foreground/40";
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-20 rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${Math.min(Math.max((rate / 60) * 100, 10), 100)}%` }}
          />
        </div>
        <span className="font-mono text-sm w-14 text-right">{rate.toFixed(1)}%</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <BarChart3 className="h-8 w-8 text-primary" />
          Civilization Statistics
        </h1>
        <p className="mt-1 text-muted-foreground">
          Win rates and pick rates from the last 30 days of ranked matches. Updated daily.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs value={mode} onValueChange={(v) => setMode(v as GameMode)}>
          <TabsList className="h-9">
            {GAME_MODES.slice(0, 4).map((m) => (
              <TabsTrigger key={m.id} value={m.id} className="text-xs">
                {m.shortLabel}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={eloRange} onValueChange={(v) => v && setEloRange(v)}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELO_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          {/* Top/Bottom Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-win" />
                  Top 5 Civilizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {top5.map((civ, i) => (
                    <Link
                      key={civ.civName}
                      href={`/civ/${civ.civName.toLowerCase().replace(/\s+/g, "_")}`}
                      className="flex items-center gap-3 rounded-lg hover:bg-accent/30 transition-colors px-1 -mx-1 py-0.5"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded">
                        <Image
                          src={getCivImageUrl(civ.civName)}
                          alt={civ.civName}
                          width={28}
                          height={28}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="flex-1 text-sm font-medium">{civ.civName}</span>
                      <WinRateBar rate={civ.winRate} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-loss" />
                  Bottom 5 Civilizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bottom5.map((civ, i) => (
                    <Link
                      key={civ.civName}
                      href={`/civ/${civ.civName.toLowerCase().replace(/\s+/g, "_")}`}
                      className="flex items-center gap-3 rounded-lg hover:bg-accent/30 transition-colors px-1 -mx-1 py-0.5"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                        {stats.length - 4 + i}
                      </span>
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded opacity-70">
                        <Image
                          src={getCivImageUrl(civ.civName)}
                          alt={civ.civName}
                          width={28}
                          height={28}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="flex-1 text-sm font-medium">{civ.civName}</span>
                      <WinRateBar rate={civ.winRate} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Win Rate</p>
                <p className="mt-1 text-2xl font-bold font-mono text-primary">
                  {avgWinRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Civilizations
                </p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total Games
                </p>
                <p className="mt-1 text-2xl font-bold font-mono">
                  {stats
                    .reduce((sum, s) => sum + s.totalGames, 0)
                    .toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Full Table */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Civilizations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("civName")}
                      >
                        <span className="flex items-center gap-1">
                          Civilization
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-right hover:text-foreground"
                        onClick={() => handleSort("winRate")}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Win Rate
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="hidden cursor-pointer text-right hover:text-foreground sm:table-cell"
                        onClick={() => handleSort("playRate")}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Pick Rate
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="hidden cursor-pointer text-right hover:text-foreground md:table-cell"
                        onClick={() => handleSort("totalGames")}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Games
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead className="hidden text-right lg:table-cell">
                        Win Rate Bar
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((civ, i) => (
                      <TableRow
                        key={civ.civName}
                        className="border-border/30 cursor-pointer hover:bg-accent/40"
                        onClick={() => {
                          window.location.href = `/civ/${civ.civName.toLowerCase().replace(/\s+/g, "_")}`;
                        }}
                      >
                        <TableCell className="text-sm text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 shrink-0 overflow-hidden rounded">
                              <Image
                                src={getCivImageUrl(civ.civName)}
                                alt={civ.civName}
                                width={24}
                                height={24}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            </div>
                            <span className="font-medium">{civ.civName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={`font-mono text-xs ${
                              civ.winRate >= 52
                                ? "border-win/30 text-win"
                                : civ.winRate <= 48
                                  ? "border-loss/30 text-loss"
                                  : "border-border text-muted-foreground"
                            }`}
                          >
                            {civ.winRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-right font-mono text-sm sm:table-cell">
                          {civ.playRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="hidden text-right font-mono text-sm md:table-cell">
                          {civ.totalGames.toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex justify-end">
                            <div className="h-2.5 w-32 rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  civ.winRate >= 52
                                    ? "bg-win/70"
                                    : civ.winRate <= 48
                                      ? "bg-loss/70"
                                      : "bg-muted-foreground/30"
                                }`}
                                style={{
                                  width: `${Math.min(Math.max(((civ.winRate - 40) / 20) * 100, 5), 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
