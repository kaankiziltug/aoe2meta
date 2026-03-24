"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Trophy, BarChart3, Users, Swords, ArrowRight, Crown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchCommand } from "@/components/layout/search-command";
import { StreakIndicator } from "@/components/shared/streak-indicator";
import { WinLossBadge } from "@/components/shared/win-loss-badge";
import { LeaderboardResponse, GameMode, CivStats } from "@/lib/api/types";
import { getCountryFlag, formatTimeAgo, GAME_MODES, getCivImageUrl } from "@/lib/constants";

export default function HomePage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<GameMode>("rm-1v1");
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [topCivs, setTopCivs] = useState<CivStats[]>([]);
  const [loadingCivs, setLoadingCivs] = useState(true);

  useEffect(() => {
    fetch("/api/stats?mode=rm-1v1")
      .then((r) => r.json())
      .then((data: CivStats[]) => {
        setTopCivs(Array.isArray(data) ? data.slice(0, 10) : []);
        setLoadingCivs(false);
      })
      .catch(() => setLoadingCivs(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    setLeaderboard(null);
    fetch(`/api/leaderboard?mode=${activeMode}&count=10`)
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeMode]);

  const totalPlayers = leaderboard?.total
    ? leaderboard.total > 1000
      ? `${(leaderboard.total / 1000).toFixed(0)}K+`
      : String(leaderboard.total)
    : "45K+";

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* AoE2 background screenshot */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        />
        {/* Dark vignette so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.70_0.20_55/0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary">
              <Swords className="mr-1.5 h-3 w-3" />
              Age of Empires II: Definitive Edition
            </Badge>
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl">
              The AoE2{" "}
              <span className="text-primary">Meta</span>{" "}
              Hub
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              Civilization win rates, leaderboards, player stats and match history — all in one place.
            </p>
            <Button
              size="lg"
              variant="outline"
              className="w-full max-w-md gap-2 border-border/50 bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              Search for a player...
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                ⌘K
              </kbd>
            </Button>

            {/* Top 10 Civs Meta Grid */}
            <div className="mt-10 w-full max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">Top Civilizations</span>
                  <span>· RM 1v1 · Latest Patch</span>
                </div>
                <Link href="/stats" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
                {loadingCivs
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/60 p-3">
                        <Skeleton className="h-5 w-5 rounded" />
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-8 rounded" />
                      </div>
                    ))
                  : topCivs.map((civ, i) => (
                      <Link href="/stats" key={civ.civName}>
                        <div className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-card/60 p-2.5 text-center backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-card/90 cursor-pointer">
                          <span className={`text-[10px] font-bold font-mono ${
                            i === 0 ? "text-yellow-400" :
                            i === 1 ? "text-slate-300" :
                            i === 2 ? "text-orange-400" :
                            "text-muted-foreground"
                          }`}>#{i + 1}</span>
                          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                            <Image
                              src={getCivImageUrl(civ.civName)}
                              alt={civ.civName}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover transition-transform group-hover:scale-110"
                              unoptimized
                            />
                          </div>
                          <span className="text-[10px] font-medium leading-tight line-clamp-1">{civ.civName}</span>
                          <span className={`text-[11px] font-bold font-mono ${
                            civ.winRate >= 52 ? "text-win" : civ.winRate >= 50 ? "text-primary" : "text-loss"
                          }`}>
                            {civ.winRate.toFixed(1)}%
                          </span>
                        </div>
                      </Link>
                    ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Stats Cards */}
      <section className="mx-auto max-w-7xl px-4 -mt-6 relative z-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            { icon: Users, label: "Ranked Players", value: totalPlayers },
            { icon: Trophy, label: "Ranked Matches", value: "142M+" },
            { icon: Swords, label: "Civilizations", value: "45" },
            { icon: BarChart3, label: "Game Modes", value: "8" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold font-mono">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Crown className="h-5 w-5 text-primary" />
                Top Players
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Current top-ranked players</p>
            </div>
            <Link href={`/leaderboard/${activeMode}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as GameMode)}>
              <TabsList className="mb-4 h-9 w-full justify-start overflow-x-auto">
                {GAME_MODES.slice(0, 4).map((mode) => (
                  <TabsTrigger key={mode.id} value={mode.id} className="text-xs">
                    {mode.shortLabel}
                  </TabsTrigger>
                ))}
              </TabsList>

              {GAME_MODES.slice(0, 4).map((mode) => (
                <TabsContent key={mode.id} value={mode.id}>
                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50 hover:bg-transparent">
                            <TableHead className="w-16">#</TableHead>
                            <TableHead>Player</TableHead>
                            <TableHead className="text-right">Rating</TableHead>
                            <TableHead className="hidden text-right sm:table-cell">W/L</TableHead>
                            <TableHead className="hidden text-right md:table-cell">Streak</TableHead>
                            <TableHead className="hidden text-right lg:table-cell">Last Match</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaderboard?.entries.map((entry) => (
                            <TableRow
                              key={entry.profileId}
                              className="border-border/30 cursor-pointer hover:bg-accent/50"
                              onClick={() => window.location.href = `/player/${entry.profileId}`}
                            >
                              <TableCell>
                                <span
                                  className={
                                    entry.rank <= 3
                                      ? "font-bold text-primary"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {entry.rank}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {entry.country && (
                                    <span className="text-base">
                                      {getCountryFlag(entry.country)}
                                    </span>
                                  )}
                                  <span className="font-medium">{entry.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-primary">
                                {entry.rating}
                              </TableCell>
                              <TableCell className="hidden text-right sm:table-cell">
                                <WinLossBadge
                                  wins={entry.wins}
                                  losses={entry.losses}
                                  showRate={false}
                                />
                              </TableCell>
                              <TableCell className="hidden text-right md:table-cell">
                                <StreakIndicator streak={entry.streak} />
                              </TableCell>
                              <TableCell className="hidden text-right text-xs text-muted-foreground lg:table-cell">
                                {formatTimeAgo(entry.lastMatch)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </section>

      {/* Quick Links */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/leaderboard/rm-1v1">
            <Card className="group border-border/50 transition-colors hover:border-primary/30 hover:bg-card/80">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Leaderboards</h3>
                  <p className="text-sm text-muted-foreground">
                    Browse rankings across all game modes
                  </p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/stats">
            <Card className="group border-border/50 transition-colors hover:border-primary/30 hover:bg-card/80">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-2/10 transition-colors group-hover:bg-chart-2/20">
                  <BarChart3 className="h-6 w-6 text-chart-2" />
                </div>
                <div>
                  <h3 className="font-semibold">Civilization Stats</h3>
                  <p className="text-sm text-muted-foreground">
                    Win rates, pick rates, and meta analysis
                  </p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
          <Card className="group border-border/50 border-dashed opacity-60">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Swords className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Game Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Coming soon — Upload and analyze replays
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
