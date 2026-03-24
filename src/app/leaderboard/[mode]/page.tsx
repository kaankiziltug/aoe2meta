"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StreakIndicator } from "@/components/shared/streak-indicator";
import { WinLossBadge } from "@/components/shared/win-loss-badge";
import { LeaderboardResponse, GameMode } from "@/lib/api/types";
import { getCountryFlag, formatTimeAgo, formatWinRate, GAME_MODES } from "@/lib/constants";
import { getRankTier } from "@/lib/rank";

const PAGE_SIZE = 25;

export default function LeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const mode = (params.mode as GameMode) || "rm-1v1";
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/leaderboard?mode=${mode}&start=${page * PAGE_SIZE}&count=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode, page]);

  const modeInfo = GAME_MODES.find((m) => m.id === mode) || GAME_MODES[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Trophy className="h-8 w-8 text-primary" />
          Leaderboards
        </h1>
        <p className="mt-1 text-muted-foreground">
          Rankings for Age of Empires II: Definitive Edition
        </p>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => {
          setPage(0);
          router.push(`/leaderboard/${v}`);
        }}
        className="mb-6"
      >
        <TabsList className="h-10 flex-wrap gap-1">
          {GAME_MODES.map((m) => (
            <TabsTrigger key={m.id} value={m.id} className="text-xs">
              {m.shortLabel}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{modeInfo.label}</CardTitle>
            {data && (
              <Badge variant="secondary" className="font-mono text-xs">
                {data.total.toLocaleString()} players
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Peak</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Games</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Win Rate</TableHead>
                      <TableHead className="hidden text-right md:table-cell">W/L</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Streak</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Last Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.entries.map((entry) => (
                      <TableRow
                        key={entry.profileId}
                        className="border-border/30 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => router.push(`/player/${entry.profileId}`)}
                      >
                        <TableCell>
                          <Link href={`/player/${entry.profileId}`} className="block">
                            {entry.rank <= 3 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                {entry.rank}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground pl-1.5">
                                {entry.rank}
                              </span>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/player/${entry.profileId}`}
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            {entry.country && (
                              <span className="text-base">{getCountryFlag(entry.country)}</span>
                            )}
                            <span className="font-medium">{entry.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`hidden xl:inline text-xs ${getRankTier(entry.rating).color}`}>
                              {getRankTier(entry.rating).emoji}
                            </span>
                            <span className="font-mono font-bold text-primary">{entry.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          <span className="font-mono text-sm text-muted-foreground">
                            {entry.highestRating}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-right font-mono text-sm sm:table-cell">
                          {entry.games}
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          <span className="font-mono text-sm">
                            {formatWinRate(entry.wins, entry.games)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          <WinLossBadge wins={entry.wins} losses={entry.losses} showRate={false} />
                        </TableCell>
                        <TableCell className="hidden text-right lg:table-cell">
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

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}-{page * PAGE_SIZE + (data?.count || 0)} of{" "}
                  {data?.total.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !data || page * PAGE_SIZE + PAGE_SIZE >= data.total
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
