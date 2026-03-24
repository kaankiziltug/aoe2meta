"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  User,
  Trophy,
  Swords,
  MapPin,
  Clock,
  TrendingUp,
  Shield,
  Target,
  Tv2,
  PlaySquare,
  ExternalLink,
  BadgeCheck,
  Timer,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { PlayerProfile, RatingPoint, GameMode } from "@/lib/api/types";
import { getCountryFlag, formatTimeAgo, formatWinRate, GAME_MODES, getCivImageUrl } from "@/lib/constants";
import { getRankTier } from "@/lib/rank";
import { RatingChart } from "@/components/player/rating-chart";

function formatDuration(started: number, finished?: number): string {
  if (!finished) return "";
  const secs = finished - started;
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export default function PlayerPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingMode, setRatingMode] = useState<GameMode>("rm-1v1");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/player/${profileId}`).then((r) => r.json()),
      fetch(`/api/player/${profileId}/rating?mode=rm-1v1`).then((r) => r.json()),
    ]).then(([profileData, ratingData]) => {
      setProfile(profileData?.error ? null : profileData);
      setRatingHistory(Array.isArray(ratingData) ? ratingData : []);
      setLoading(false);
    });
  }, [profileId]);

  useEffect(() => {
    fetch(`/api/player/${profileId}/rating?mode=${ratingMode}`)
      .then((r) => r.json())
      .then((data) => setRatingHistory(Array.isArray(data) ? data : []));
  }, [profileId, ratingMode]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <User className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h1 className="mt-4 text-2xl font-bold">Player Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The player profile you are looking for does not exist.
        </p>
      </div>
    );
  }

  const winRate = profile.totalGames > 0
    ? ((profile.totalWins / profile.totalGames) * 100).toFixed(1)
    : "0";
  const losses = profile.totalGames - profile.totalWins;

  // Only show modes the player has ratings in
  const activeModes = GAME_MODES.filter((m) => profile.ratings?.[m.id]);
  const rm1v1Rating = profile.ratings?.["rm-1v1"] ?? 0;
  const rankTier = getRankTier(rm1v1Rating);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Player Header Card */}
      <Card className="border-border/50 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Avatar + Name */}
            <div className="flex items-start gap-4 flex-1">
              <div className="relative shrink-0">
                {profile.avatarUrl ? (
                  <div className="h-20 w-20 overflow-hidden rounded-2xl ring-2 ring-primary/20">
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.name}
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-2 ring-primary/20">
                    <User className="h-9 w-9" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold truncate">{profile.name}</h1>
                  {profile.verified && (
                    <BadgeCheck className="h-5 w-5 text-primary shrink-0" aria-label="Verified player" />
                  )}
                  {rm1v1Rating > 0 && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rankTier.bgColor} ${rankTier.color}`}>
                      {rankTier.emoji} {rankTier.name}
                    </span>
                  )}
                  {profile.clan && (
                    <Badge variant="outline" className="border-primary/30 text-primary shrink-0">
                      [{profile.clan}]
                    </Badge>
                  )}
                </div>

                {/* Meta info */}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {profile.country && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-base">{getCountryFlag(profile.country)}</span>
                      <span className="uppercase text-xs tracking-wider">{profile.country}</span>
                    </span>
                  )}
                  {profile.lastMatchTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Last match {formatTimeAgo(profile.lastMatchTime)}
                    </span>
                  )}
                </div>

                {/* Social links */}
                {(profile.twitchUrl || profile.youtubeUrl || profile.discordUrl || profile.liquipediaUrl) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.twitchUrl && (
                      <a
                        href={profile.twitchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[#9146FF]/30 hover:bg-[#9146FF]/10 hover:text-[#9146FF]"
                      >
                        <Tv2 className="h-3.5 w-3.5" />
                        Twitch
                      </a>
                    )}
                    {profile.youtubeUrl && (
                      <a
                        href={profile.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[#FF0000]/30 hover:bg-[#FF0000]/10 hover:text-[#FF0000]"
                      >
                        <PlaySquare className="h-3.5 w-3.5" />
                        YouTube
                      </a>
                    )}
                    {profile.liquipediaUrl && (
                      <a
                        href={profile.liquipediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Liquipedia
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Rating Badges */}
            {activeModes.length > 0 && (
              <div className="flex flex-wrap gap-2 md:justify-end">
                {activeModes.map(({ id, shortLabel }) => {
                  const rating = profile.ratings?.[id];
                  const isPrimary = id === "rm-1v1";
                  return (
                    <div
                      key={id}
                      className={`flex flex-col items-center rounded-xl border px-4 py-2 ${
                        isPrimary
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/50 bg-muted/20"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {shortLabel}
                      </span>
                      <span className={`text-xl font-bold font-mono ${isPrimary ? "text-primary" : ""}`}>
                        {rating}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="my-5 opacity-40" />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Swords className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Games</p>
                <p className="text-lg font-bold font-mono">{profile.totalGames.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-win/10">
                <Trophy className="h-5 w-5 text-win" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wins</p>
                <p className="text-lg font-bold font-mono">{profile.totalWins.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-loss/10">
                <Target className="h-5 w-5 text-loss" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Losses</p>
                <p className="text-lg font-bold font-mono">{losses.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-lg font-bold font-mono text-primary">{winRate}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rating History Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Rating History
            </CardTitle>
            {activeModes.length > 0 && (
              <Tabs value={ratingMode} onValueChange={(v) => setRatingMode(v as GameMode)}>
                <TabsList className="h-8 flex-wrap">
                  {activeModes.map((m) => (
                    <TabsTrigger key={m.id} value={m.id} className="text-xs px-2 h-6">
                      {m.shortLabel}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <RatingChart data={ratingHistory} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Best Civilizations */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Best Civilizations
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                from last {profile.recentMatches.length} matches
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.bestCivs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Not enough ranked games to show
              </p>
            ) : (
              <div className="space-y-3">
                {profile.bestCivs.slice(0, 6).map((civ, i) => (
                  <div key={`${civ.civId}-${civ.civName}`} className="flex items-center gap-3">
                    <span className="w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
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
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{civ.civName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{civ.games}g</span>
                          <span className="font-mono text-sm font-semibold text-primary">
                            {civ.winRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{ width: `${Math.min(civ.winRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Best Maps */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Best Maps
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                from last {profile.recentMatches.length} matches
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.bestMaps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Not enough games to show
              </p>
            ) : (
              <div className="space-y-3">
                {profile.bestMaps.slice(0, 6).map((map, i) => (
                  <div key={map.mapName} className="flex items-center gap-3">
                    <span className="w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{map.mapName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{map.games}g</span>
                          <span className="font-mono text-sm font-semibold text-primary">
                            {map.winRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-chart-2/70 transition-all"
                          style={{ width: `${Math.min(map.winRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Matches */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            Recent Matches
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {profile.recentMatches.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {profile.recentMatches.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No recent matches found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-24 pl-6">Result</TableHead>
                    <TableHead>Map</TableHead>
                    <TableHead>Civilization</TableHead>
                    <TableHead className="hidden md:table-cell">Opponent</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">ELO</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      <span className="flex items-center justify-end gap-1">
                        <Timer className="h-3.5 w-3.5" />
                        Duration
                      </span>
                    </TableHead>
                    <TableHead className="text-right pr-6">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.recentMatches.slice(0, 20).map((match) => {
                    const player = match.players.find(
                      (p) => p.profileId === profile.profileId
                    );
                    const opponents = match.players.filter(
                      (p) => p.profileId !== profile.profileId && p.team !== player?.team
                    );
                    const mainOpponent = opponents[0];
                    const won = player?.won;
                    const duration = formatDuration(match.started, match.finished);

                    return (
                      <TableRow key={match.matchId} className="border-border/30 hover:bg-accent/30">
                        <TableCell className="pl-6">
                          <div className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${
                            won
                              ? "bg-win/10 text-win"
                              : won === false
                              ? "bg-loss/10 text-loss"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {won === true ? "Victory" : won === false ? "Defeat" : "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{match.mapName}</span>
                            {!match.ranked && (
                              <span className="text-[10px] text-muted-foreground">Unranked</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {player?.civName ? (
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 shrink-0 overflow-hidden rounded">
                                <Image
                                  src={getCivImageUrl(player.civName)}
                                  alt={player.civName}
                                  width={24}
                                  height={24}
                                  className="h-full w-full object-cover"
                                  unoptimized
                                />
                              </div>
                              <span className="text-sm font-medium">{player.civName}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {mainOpponent ? (
                            <Link
                              href={`/player/${mainOpponent.profileId}`}
                              className="group flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                            >
                              {mainOpponent.country && (
                                <span className="text-xs">{getCountryFlag(mainOpponent.country)}</span>
                              )}
                              <span className="group-hover:underline">{mainOpponent.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({mainOpponent.civName})
                              </span>
                              {opponents.length > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  +{opponents.length - 1}
                                </span>
                              )}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          {player?.ratingChange !== undefined && player.ratingChange !== 0 ? (
                            <span className={`font-mono text-sm font-semibold ${
                              player.ratingChange > 0 ? "text-win" : "text-loss"
                            }`}>
                              {player.ratingChange > 0 ? "+" : ""}{player.ratingChange}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right text-sm text-muted-foreground md:table-cell">
                          {duration || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground pr-6">
                          {formatTimeAgo(match.started)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
