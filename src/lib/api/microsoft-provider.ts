/**
 * Multi-source AoE2 DE API Provider
 *
 * Sources:
 *   1. Microsoft API (api.ageofempires.com/api/v2/ageii)  → Leaderboard + Search
 *   2. WorldsEdge API (aoe-api.worldsedgelink.com)        → Player stats, match history
 *   3. AoE2Companion (data.aoe2companion.com)              → Profiles, rich match history
 */

import {
  AoE2DataProvider,
  CivChange,
  CivDetail,
  CivEloBreakdown,
  CivPatchPoint,
  CivStats,
  GameMode,
  LeaderboardEntry,
  LeaderboardResponse,
  MapStats,
  Match,
  MatchPlayer,
  MetaReport,
  Player,
  PlayerProfile,
  RatingPoint,
} from "./types";
import { MockDataProvider } from "./mock-data";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const MS_API = "https://api.ageofempires.com/api/v2/ageii";
const WE_API = "https://aoe-api.worldsedgelink.com/community/leaderboard";
const COMPANION_API = "https://data.aoe2companion.com/api";

// ═══════════════════════════════════════════════════════════════════════════════
// CACHES (globalThis to survive HMR)
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_TTL = 5 * 60 * 1000;

function getGlobal<T>(key: string, init: () => T): T {
  const g = globalThis as Record<string, unknown>;
  if (!g[key]) g[key] = init();
  return g[key] as T;
}

// Total-count cache for leaderboard pagination
function getTotalCache() {
  return getGlobal<Record<string, { total: number; ts: number }>>(
    "__aoe2_total__",
    () => ({})
  );
}
function getCachedTotal(key: string): number | null {
  const entry = getTotalCache()[key];
  if (!entry || Date.now() - entry.ts > CACHE_TTL) return null;
  return entry.total;
}
function setCachedTotal(key: string, total: number) {
  getTotalCache()[key] = { total, ts: Date.now() };
}

// Player cache (populated by search & leaderboard)
function getPlayerCache() {
  return getGlobal<Map<number, { item: MsLeaderboardItem; ts: number }>>(
    "__aoe2_players__",
    () => new Map()
  );
}
function cachePlayer(item: MsLeaderboardItem) {
  const c = getPlayerCache();
  if (c.size >= 500) {
    const first = c.keys().next().value;
    if (first !== undefined) c.delete(first);
  }
  c.set(item.rlUserId, { item, ts: Date.now() });
}
function cachePlayers(items: MsLeaderboardItem[]) {
  for (const i of items) cachePlayer(i);
}
function getCachedPlayer(id: number): MsLeaderboardItem | null {
  const entry = getPlayerCache().get(id);
  if (!entry || Date.now() - entry.ts > 10 * 60 * 1000) return null;
  return entry.item;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAW API TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Microsoft Leaderboard ────────────────────────────────────────────────────
interface MsLeaderboardItem {
  gameId: string;
  rlUserId: number;
  userName: string;
  avatarUrl: string;
  elo: number;
  eloRating: number;
  eloHighest: number;
  rank: number;
  rankTotal: number;
  wins: number;
  winPercent: number;
  losses: number;
  winStreak: number;
  totalGames: number;
  region: string;
}
interface MsLeaderboardResponse {
  count: number;
  items: MsLeaderboardItem[];
}

// ── WorldsEdge GetPersonalStat ───────────────────────────────────────────────
interface WeStat {
  leaderboard_id: number;
  statgroup_id?: number;
  wins: number;
  losses: number;
  streak: number;
  drops: number;
  rank: number;
  ranktotal: number;
  rating: number;
  regionrank: number;
  lastmatchdate: number;
  highestrank: number;
  highestrating: number;
}
interface WeStatGroup {
  id?: number;
  members: {
    profile_id: number;
    alias: string;
    country: string;
    xp: number;
    level: number;
  }[];
}
interface WePersonalStatResponse {
  result: { code: number };
  statGroups: WeStatGroup[];
  leaderboardStats: WeStat[];
}
interface WeLeaderboardResponse {
  result: { code: number };
  statGroups: WeStatGroup[];
  leaderboardStats: WeStat[];
  rankTotal?: number;
}

// ── AoE2Companion matches ────────────────────────────────────────────────────
interface CompanionPlayer {
  profileId: number;
  name: string;
  rating: number;
  ratingDiff: number;
  civ: string;
  civName: string;
  civImageUrl: string;
  color: number;
  won: boolean;
  country: string;
  team: number;
}
interface CompanionMatch {
  matchId: number;
  started: string;
  finished: string;
  leaderboard: string;
  leaderboardId: string;
  internalLeaderboardId?: number;
  mapName: string;
  gameMode: string;
  teams: { teamId: number; players: CompanionPlayer[] }[];
}
interface CompanionMatchesResponse {
  matches: CompanionMatch[];
}

// ── AoE2Companion profile ────────────────────────────────────────────────────
interface CompanionProfile {
  profileId: number;
  name: string;
  country: string;
  clan: string;
  steamId: string;
  games: string;
  verified: boolean;
  avatarhash?: string;
  socialTwitchChannelUrl?: string;
  socialYoutubeChannelUrl?: string;
  socialDiscordInvitationUrl?: string;
  socialLiquipedia?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AOESTATS.IO RAW TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AoestatsCiv {
  civ_name: string;
  rank: number;
  prior_rank?: number;
  win_rate: number;
  play_rate: number;
  num_games: number;
  wins: number;
  ci_lower: number;
  ci_upper: number;
  by_map: Record<string, { wins: number; win_rate: number; num_games: number; play_rate: number; ci_lower: number; ci_upper: number }>;
  by_matchup: Record<string, { wins: number; win_rate: number; num_games: number; play_rate: number; ci_lower: number; ci_upper: number }>;
  by_game_time: Record<string, { wins: number; win_rate: number; num_games: number; play_rate: number; ci_lower: number; ci_upper: number }>;
  avg_feudal_time: number;
  avg_castle_time: number;
  avg_imperial_time: number;
  avg_game_length: number;
}

interface AoestatsStatsEntry {
  patch: number;
  grouping: string;
  elo_grouping: string;
  total_games: number;
  civ_stats: Record<string, AoestatsCiv>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME MODE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

interface MsModeParams {
  versus: "players" | "team";
  matchType: "ranked" | "unranked";
  teamSize: "1v1" | "2v2" | "3v3" | "4v4";
}

function gameModeToParams(mode: GameMode): MsModeParams {
  switch (mode) {
    case "rm-1v1":
      return { versus: "players", matchType: "ranked", teamSize: "1v1" };
    case "rm-team":
      return { versus: "team", matchType: "ranked", teamSize: "2v2" };
    case "ew-1v1":
      return { versus: "players", matchType: "unranked", teamSize: "1v1" };
    case "ew-team":
      return { versus: "team", matchType: "unranked", teamSize: "2v2" };
    default:
      return { versus: "players", matchType: "ranked", teamSize: "1v1" };
  }
}

// WorldsEdge leaderboard_id → our GameMode
const LEADERBOARD_ID_MAP: Record<number, GameMode> = {
  3: "rm-1v1",
  4: "rm-team",
  13: "ew-1v1",
  14: "ew-team",
  1: "dm-1v1",
  2: "dm-team",
  26: "ror-1v1",
  27: "ror-team",
};

function gameModeToLeaderboardId(mode: GameMode): number {
  for (const [id, m] of Object.entries(LEADERBOARD_ID_MAP)) {
    if (m === mode) return Number(id);
  }
  return 3; // default: rm-1v1
}

// AoE2Companion leaderboard string IDs
function gameModeToCompanionId(mode: GameMode): string {
  switch (mode) {
    case "rm-1v1": return "rm_1v1";
    case "rm-team": return "rm_team";
    case "ew-1v1": return "ew_1v1";
    case "ew-team": return "ew_team";
    case "dm-1v1": return "dm_1v1";
    case "dm-team": return "dm_team";
    case "ror-1v1": return "ror_1v1";
    case "ror-team": return "ror_team";
    default: return "rm_1v1";
  }
}

function companionIdToGameMode(id: string): GameMode {
  switch (id) {
    case "rm_1v1": return "rm-1v1";
    case "rm_team": return "rm-team";
    case "ew_1v1": return "ew-1v1";
    case "ew_team": return "ew-team";
    case "dm_1v1": return "dm-1v1";
    case "dm_team": return "dm-team";
    case "ror_1v1": return "ror-1v1";
    case "ror_team": return "ror-team";
    default: return "rm-1v1";
  }
}

function gameModeToAoestatsGrouping(mode: GameMode): string {
  switch (mode) {
    case "rm-team": return "team_random_map";
    default: return "random_map";
  }
}

function gameModeToCompanionLeaderboard(mode: GameMode): string {
  switch (mode) {
    case "rm-1v1":   return "rm_1v1";
    case "rm-team":  return "rm_team";
    case "ew-1v1":   return "ew_1v1";
    case "ew-team":  return "ew_team";
    case "dm-1v1":   return "dm_1v1";
    case "dm-team":  return "dm_team";
    case "ror-1v1":  return "ror_1v1";
    case "ror-team": return "ror_team";
    default:         return "rm_1v1";
  }
}


function eloRangeToAoestatsGroup(range?: [number, number]): string {
  if (!range) return "all";
  const [min] = range;
  if (min >= 1800) return "high";
  if (min >= 1400) return "med_high";
  if (min >= 1100) return "medium";
  if (min >= 800) return "med_low";
  return "low";
}

/** "britons" → "Britons", "el dorado" → "El Dorado", "wu" → "Wu" */
function capitalizeCivName(name: string): string {
  return name
    .split(/[\s_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function modeKey(params: MsModeParams): string {
  return `${params.versus}:${params.matchType}:${params.teamSize}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export class MicrosoftApiProvider implements AoE2DataProvider {
  private mock = new MockDataProvider();

  // ── Microsoft Leaderboard fetch ─────────────────────────────────────────────

  private async fetchLeaderboard(body: {
    versus: string;
    matchType: string;
    teamSize: string;
    searchPlayer: string;
    page: number;
    count: number;
  }): Promise<MsLeaderboardResponse> {
    const res = await fetch(`${MS_API}/Leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ region: 7, ...body }),
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`MS API ${res.status}`);
    const text = await res.text();
    if (!text) throw new Error("MS API empty response");
    return JSON.parse(text) as MsLeaderboardResponse;
  }

  private mapEntry(item: MsLeaderboardItem): LeaderboardEntry {
    return {
      rank: item.rank,
      profileId: item.rlUserId,
      name: item.userName,
      rating: item.elo || item.eloHighest,
      highestRating: item.eloHighest ?? item.elo,
      games: item.totalGames,
      wins: item.wins,
      losses: item.losses,
      streak: item.winStreak,
      lastMatch: Math.floor(Date.now() / 1000) - 86400,
    };
  }

  private async getTotal(params: MsModeParams): Promise<number> {
    const key = modeKey(params);
    const cached = getCachedTotal(key);
    if (cached !== null) return cached;
    const probe = await this.fetchLeaderboard({
      ...params,
      searchPlayer: "",
      page: 1,
      count: 1,
    });
    setCachedTotal(key, probe.count);
    return probe.count;
  }

  // ── WorldsEdge fetch ────────────────────────────────────────────────────────

  private async fetchPersonalStats(profileId: number): Promise<WePersonalStatResponse> {
    const res = await fetch(
      `${WE_API}/GetPersonalStat?title=age2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `profile_ids=%5B${profileId}%5D`,
        next: { revalidate: 120 },
      }
    );
    if (!res.ok) throw new Error(`WE API ${res.status}`);
    return res.json() as Promise<WePersonalStatResponse>;
  }

  private async fetchWeLeaderboard(
    leaderboardId: number,
    page: number,
    count: number
  ): Promise<WeLeaderboardResponse> {
    const url =
      `${WE_API}/getLeaderboard2?title=age2&platform=PC_Steam` +
      `&leaderboard_id=${leaderboardId}&profile_ids=%5B%5D` +
      `&region=2000&page=${page}&count=${count}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`WE Leaderboard ${res.status}`);
    return res.json() as Promise<WeLeaderboardResponse>;
  }

  private async getWeLeaderboard(
    mode: GameMode,
    start: number,
    count: number
  ): Promise<LeaderboardResponse> {
    const leaderboardId = gameModeToLeaderboardId(mode);
    const page = Math.floor(start / count) + 1;
    const data = await this.fetchWeLeaderboard(leaderboardId, page, count);

    const groups = data.statGroups ?? [];
    const stats = data.leaderboardStats ?? [];

    // statGroups[i] and leaderboardStats[i] are aligned by array index
    const entries: LeaderboardEntry[] = stats.map((stat, i) => {
      const member = groups[i]?.members?.[0];
      return {
        profileId: member?.profile_id ?? 0,
        name: member?.alias ?? "Unknown",
        country: member?.country ?? "",
        rank: stat.rank ?? start + i + 1,
        rating: stat.rating ?? 0,
        highestRating: stat.highestrating ?? 0,
        wins: stat.wins ?? 0,
        losses: stat.losses ?? 0,
        games: (stat.wins ?? 0) + (stat.losses ?? 0),
        streak: stat.streak ?? 0,
        lastMatch: stat.lastmatchdate ?? 0,
      };
    });

    return {
      total: data.rankTotal ?? entries.length,
      start,
      count: entries.length,
      entries,
    };
  }

  // ── AoE2Companion fetch ─────────────────────────────────────────────────────

  private async fetchCompanionProfile(profileId: number): Promise<CompanionProfile | null> {
    try {
      const res = await fetch(`${COMPANION_API}/profiles/${profileId}`, {
        headers: { "User-Agent": "AoE2Insights/1.0" },
        next: { revalidate: 300 },
      });
      if (!res.ok) return null;
      return res.json() as Promise<CompanionProfile>;
    } catch {
      return null;
    }
  }

  private async fetchCompanionMatches(
    profileId: number,
    count: number
  ): Promise<CompanionMatch[]> {
    try {
      const res = await fetch(
        `${COMPANION_API}/matches?profile_ids=${profileId}&count=${count}`,
        {
          headers: { "User-Agent": "AoE2Insights/1.0" },
          next: { revalidate: 120 },
        }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as CompanionMatchesResponse;
      return data.matches ?? [];
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC INTERFACE
  // ═══════════════════════════════════════════════════════════════════════════

  async searchPlayers(query: string): Promise<Player[]> {
    // Run Microsoft API + AoE2Companion search in parallel
    const [msData, companionData] = await Promise.allSettled([
      this.fetchLeaderboard({
        versus: "players",
        matchType: "ranked",
        teamSize: "1v1",
        searchPlayer: query,
        page: 1,
        count: 100,
      }),
      Promise.all([
        fetch(`${COMPANION_API}/profiles?search=${encodeURIComponent(query)}&count=50&page=1`, { headers: { "User-Agent": "AoE2Insights/1.0" } }).then((r) => r.json()),
        fetch(`${COMPANION_API}/profiles?search=${encodeURIComponent(query)}&count=50&page=2`, { headers: { "User-Agent": "AoE2Insights/1.0" } }).then((r) => r.json()),
      ]).then(([p1, p2]) => ({ profiles: [...(p1?.profiles ?? []), ...(p2?.profiles ?? [])] })),
    ]);

    // Build map from profileId → Player (MS API first, has ratings)
    const results = new Map<number, Player>();

    if (msData.status === "fulfilled") {
      const items = msData.value.items ?? [];
      cachePlayers(items);
      for (const item of items) {
        results.set(item.rlUserId, {
          profileId: item.rlUserId,
          name: item.userName,
          ratings: { "rm-1v1": item.elo || item.eloHighest },
        });
      }
    }

    // Add Companion results not already in map (broader search coverage)
    if (companionData.status === "fulfilled") {
      const profiles: CompanionProfile[] = companionData.value?.profiles ?? [];
      for (const p of profiles) {
        if (!results.has(p.profileId)) {
          results.set(p.profileId, {
            profileId: p.profileId,
            name: p.name,
            ratings: {},
          });
        }
      }
    }

    const q = query.toLowerCase();
    return Array.from(results.values())
      .sort((a, b) => {
        // Exact match always comes first
        const exactA = a.name.toLowerCase() === q ? 1 : 0;
        const exactB = b.name.toLowerCase() === q ? 1 : 0;
        if (exactB !== exactA) return exactB - exactA;
        // Then by rating desc
        return (b.ratings?.["rm-1v1"] ?? 0) - (a.ratings?.["rm-1v1"] ?? 0);
      })
      .slice(0, 20);
  }

  async getLeaderboard(
    mode: GameMode,
    start: number,
    count: number
  ): Promise<LeaderboardResponse> {
    // Use WorldsEdge getLeaderboard2 for all modes — more reliable than MS API
    return this.getWeLeaderboard(mode, start, count);

    // eslint-disable-next-line no-unreachable
    const params = gameModeToParams(mode);
    const total = await this.getTotal(params);
    const topItemOffset = total - 1 - start;
    const topPage = Math.max(1, Math.ceil((topItemOffset + 1) / count));
    const bottomItemOffset = topItemOffset - count + 1;
    const topPageFloor = (topPage - 1) * count;
    const needsPrevPage = topPage > 1 && bottomItemOffset < topPageFloor;

    let rawItems: MsLeaderboardItem[];
    if (needsPrevPage) {
      const [topData, prevData] = await Promise.all([
        this.fetchLeaderboard({ ...params, searchPlayer: "", page: topPage, count }),
        this.fetchLeaderboard({ ...params, searchPlayer: "", page: topPage - 1, count }),
      ]);
      rawItems = [...(topData.items ?? []), ...(prevData.items ?? [])];
    } else {
      const data = await this.fetchLeaderboard({
        ...params,
        searchPlayer: "",
        page: topPage,
        count,
      });
      rawItems = data.items ?? [];
    }
    cachePlayers(rawItems);

    // Deduplicate by profileId (same player can appear on both API pages at boundary)
    const seenIds = new Set<number>();
    const entries = rawItems
      .map((item) => this.mapEntry(item))
      .sort((a, b) => a.rank - b.rank)
      .filter((e) => {
        if (e.rank < start + 1 || e.rank > start + count) return false;
        if (seenIds.has(e.profileId)) return false;
        seenIds.add(e.profileId);
        return true;
      });

    return { total, start, count: entries.length, entries };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYER PROFILE  (WorldsEdge + AoE2Companion + cache)
  // ═══════════════════════════════════════════════════════════════════════════

  async getPlayerProfile(profileId: number): Promise<PlayerProfile> {
    // Fetch from multiple sources in parallel
    const [weStats, companionProfile, companionMatches] = await Promise.all([
      this.fetchPersonalStats(profileId).catch(() => null),
      this.fetchCompanionProfile(profileId),
      this.fetchCompanionMatches(profileId, 50),
    ]);

    // ── Extract identity ──────────────────────────────────────────────────────
    const weMember = weStats?.statGroups?.[0]?.members?.[0];
    const name =
      weMember?.alias ||
      companionProfile?.name ||
      getCachedPlayer(profileId)?.userName ||
      "Unknown";
    const country =
      companionProfile?.country ||
      weMember?.country ||
      undefined;
    const clan = companionProfile?.clan || undefined;

    // ── Extract ratings per mode from WorldsEdge ──────────────────────────────
    const ratings: Partial<Record<GameMode, number>> = {};
    let totalGames = 0;
    let totalWins = 0;

    if (weStats?.leaderboardStats) {
      for (const stat of weStats.leaderboardStats) {
        const mode = LEADERBOARD_ID_MAP[stat.leaderboard_id];
        if (mode && stat.rating > 0) {
          ratings[mode] = stat.rating;
        }
        totalGames += stat.wins + stat.losses;
        totalWins += stat.wins;
      }
    }

    // Fallback to cache if WorldsEdge failed
    if (totalGames === 0) {
      const cached = getCachedPlayer(profileId);
      if (cached) {
        ratings["rm-1v1"] = cached.elo || cached.eloHighest;
        totalGames = cached.totalGames;
        totalWins = cached.wins;
      }
    }

    // ── Build recent matches from AoE2Companion ──────────────────────────────
    const recentMatches: Match[] = companionMatches.map((m) =>
      this.companionMatchToMatch(m, profileId)
    );

    // ── Compute best civs from match history ─────────────────────────────────
    const civMap = new Map<string, { wins: number; games: number }>();
    const mapMap = new Map<string, { wins: number; games: number }>();

    for (const m of companionMatches) {
      const player = this.findPlayerInCompanionMatch(m, profileId);
      if (!player) continue;

      // Civ stats
      const civKey = player.civName || player.civ;
      if (civKey) {
        const c = civMap.get(civKey) ?? { wins: 0, games: 0 };
        c.games++;
        if (player.won) c.wins++;
        civMap.set(civKey, c);
      }

      // Map stats
      const mapKey = m.mapName;
      if (mapKey) {
        const mp = mapMap.get(mapKey) ?? { wins: 0, games: 0 };
        mp.games++;
        if (player.won) mp.wins++;
        mapMap.set(mapKey, mp);
      }
    }

    const bestCivs = [...civMap.entries()]
      .filter(([, s]) => s.games >= 2)
      .map(([name, s]) => ({
        civId: 0,
        civName: name,
        winRate: (s.wins / s.games) * 100,
        games: s.games,
      }))
      .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
      .slice(0, 8);

    const bestMaps = [...mapMap.entries()]
      .filter(([, s]) => s.games >= 2)
      .map(([name, s]) => ({
        mapName: name,
        winRate: (s.wins / s.games) * 100,
        games: s.games,
      }))
      .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
      .slice(0, 8);

    // ── Avatar URL (Steam CDN via avatarhash) ────────────────────────────────
    const avatarUrl = companionProfile?.avatarhash
      ? `https://avatars.akamai.steamstatic.com/${companionProfile.avatarhash}_full.jpg`
      : undefined;

    // ── Assemble profile ─────────────────────────────────────────────────────
    const profile: PlayerProfile = {
      profileId,
      name,
      country,
      clan: clan || undefined,
      ratings,
      totalGames,
      totalWins,
      avatarUrl,
      steamId: companionProfile?.steamId,
      verified: companionProfile?.verified,
      twitchUrl: companionProfile?.socialTwitchChannelUrl,
      youtubeUrl: companionProfile?.socialYoutubeChannelUrl,
      discordUrl: companionProfile?.socialDiscordInvitationUrl,
      liquipediaUrl: companionProfile?.socialLiquipedia
        ? `https://liquipedia.net/ageofempires/${companionProfile.socialLiquipedia}`
        : undefined,
      lastMatchTime: recentMatches[0]?.started,
      bestCivs,
      bestMaps,
      recentMatches: recentMatches.slice(0, 20),
    };

    return profile;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RATING HISTORY  (derived from AoE2Companion match history)
  // ═══════════════════════════════════════════════════════════════════════════

  async getRatingHistory(
    profileId: number,
    mode: GameMode
  ): Promise<RatingPoint[]> {
    const matches = await this.fetchCompanionMatches(profileId, 100);
    const companionLeaderboard = gameModeToCompanionId(mode);

    const points: RatingPoint[] = [];

    for (const m of matches) {
      // AoE2Companion uses string IDs: "rm_1v1", "rm_team", "ew_1v1", etc.
      if (m.leaderboardId !== companionLeaderboard) continue;

      const player = this.findPlayerInCompanionMatch(m, profileId);
      if (!player || !player.rating) continue;

      const timestamp = Math.floor(new Date(m.started).getTime() / 1000);
      points.push({
        rating: player.rating,
        timestamp,
        numWins: player.won ? 1 : 0,
        numLosses: player.won ? 0 : 1,
        streak: 0,
      });
    }

    // Sort oldest first
    points.sort((a, b) => a.timestamp - b.timestamp);
    return points;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCH HISTORY  (AoE2Companion)
  // ═══════════════════════════════════════════════════════════════════════════

  async getMatchHistory(
    profileId: number,
    _start: number,
    count: number
  ): Promise<Match[]> {
    const matches = await this.fetchCompanionMatches(profileId, count);
    return matches.map((m) => this.companionMatchToMatch(m, profileId));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CIV DETAIL  (aoestats.io — fetches all elo ranges in parallel)
  // ═══════════════════════════════════════════════════════════════════════════

  async getCivDetail(civSlug: string, mode: GameMode = "rm-1v1"): Promise<CivDetail | null> {
    try {
      const grouping = gameModeToAoestatsGrouping(mode);
      const patch = await this.getLatestAoestatsPatch();
      const ELO_RANGES = ["all", "low", "med_low", "medium", "med_high", "high"] as const;
      const ELO_LABELS: Record<string, string> = {
        all: "All Elos", low: "<800", med_low: "800–1100",
        medium: "1100–1400", med_high: "1400–1800", high: "1800+",
      };

      // Fetch all elo ranges in parallel
      const responses = await Promise.all(
        ELO_RANGES.map((elo) =>
          fetch(`https://aoestats.io/api/stats/?patch=${patch}&grouping=${grouping}&elo_range=${elo}`, {
            headers: { Accept: "*/*", "User-Agent": "AoE2Insights/1.0" },
            next: { revalidate: 3600 },
          }).then((r) => (r.ok ? r.json() : null))
        )
      );

      // Parse "all" response for main stats
      const allData = responses[0] as AoestatsStatsEntry[] | null;
      if (!allData?.[0]?.civ_stats) return null;

      // Find civ in the data — slug may be "britons" or "el_dorado" style
      const civStats = allData[0].civ_stats;
      const civKey = Object.keys(civStats).find(
        (k) =>
          k === civSlug ||
          k.replace(/\s+/g, "_") === civSlug ||
          civStats[k].civ_name?.replace(/\s+/g, "_") === civSlug
      );
      if (!civKey) return null;

      const civ = civStats[civKey];
      const civName = capitalizeCivName(civ.civ_name ?? civKey);

      // By-map stats (filter small sample size)
      const mapEntries = Object.entries(civ.by_map ?? {})
        .filter(([, m]) => m.num_games >= 50)
        .map(([mapName, m]) => ({
          mapName: capitalizeCivName(mapName),
          winRate: m.win_rate * 100,
          numGames: m.num_games,
          playRate: m.play_rate * 100,
        }))
        .sort((a, b) => b.winRate - a.winRate);

      // Matchup stats (filter small sample size)
      const matchupEntries = Object.entries(civ.by_matchup ?? {})
        .filter(([, m]) => m.num_games >= 100)
        .map(([oppKey, m]) => ({
          civName: capitalizeCivName(civStats[oppKey]?.civ_name ?? oppKey),
          winRate: m.win_rate * 100,
          numGames: m.num_games,
        }))
        .sort((a, b) => b.winRate - a.winRate);

      // Game length
      const gameLengthOrder = ["quick", "medium", "long"];
      const gameLengthLabels: Record<string, string> = {
        quick: "Quick (<20min)", medium: "Medium (20–40min)", long: "Long (40min+)",
      };
      const byGameLength = gameLengthOrder
        .filter((k) => civ.by_game_time?.[k])
        .map((k) => ({
          label: gameLengthLabels[k],
          winRate: civ.by_game_time[k].win_rate * 100,
          numGames: civ.by_game_time[k].num_games,
        }));

      // ELO breakdown
      const eloBreakdown: CivEloBreakdown[] = ELO_RANGES.map((elo, i) => {
        const eloData = responses[i] as AoestatsStatsEntry[] | null;
        const eloCivStats = eloData?.[0]?.civ_stats;
        const eloCiv = eloCivStats?.[civKey];
        return {
          elo,
          eloLabel: ELO_LABELS[elo],
          winRate: eloCiv ? eloCiv.win_rate * 100 : 0,
          numGames: eloCiv?.num_games ?? 0,
          playRate: eloCiv ? eloCiv.play_rate * 100 : 0,
          rank: eloCiv?.rank ?? 0,
        };
      });

      return {
        civName,
        civSlug,
        rank: civ.rank,
        winRate: civ.win_rate * 100,
        playRate: civ.play_rate * 100,
        totalGames: civ.num_games,
        eloBreakdown,
        topMaps: mapEntries.slice(0, 6),
        bottomMaps: mapEntries.slice(-5).reverse(),
        bestMatchups: matchupEntries.slice(0, 8),
        worstMatchups: matchupEntries.slice(-8).reverse(),
        byGameLength,
        avgFeudalTime: civ.avg_feudal_time ?? 0,
        avgCastleTime: civ.avg_castle_time ?? 0,
        avgImperialTime: civ.avg_imperial_time ?? 0,
        avgGameLength: civ.avg_game_length ?? 0,
      };
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CIV STATS  (computed from aoe2companion recent matches — includes all DLC civs)
  // Fetches ~3000 recent matches in parallel batches and tallies win/loss per civ
  // ═══════════════════════════════════════════════════════════════════════════

  private readAccumulatedStats(mode: GameMode): CivStats[] | null {
    try {
      const filePath = resolve(process.cwd(), "src/data/civ-stats-accumulated.json");
      if (!existsSync(filePath)) return null;

      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as {
        lastFetch: string;
        totalMatches: number;
        modes: Record<string, Record<string, { wins: number; games: number }>>;
      };

      const modeCivs = raw.modes?.[mode];
      if (!modeCivs || Object.keys(modeCivs).length === 0) return null;

      // Reject data older than 48 hours — fall back to live computation
      const age = Date.now() - new Date(raw.lastFetch).getTime();
      if (age > 48 * 60 * 60 * 1000) return null;

      const totalGameSlots = Object.values(modeCivs).reduce((s, v) => s + v.games, 0);

      const result: CivStats[] = Object.entries(modeCivs)
        .filter(([civName, v]) => v.games >= 10 && !civName.startsWith("["))
        .map(([civName, v], idx) => ({
          civId: idx,
          civName,
          winRate: (v.wins / v.games) * 100,
          playRate: (v.games / totalGameSlots) * 100,
          avgRating: 0,
          totalGames: v.games,
        }))
        .sort((a, b) => b.winRate - a.winRate);

      return result.length > 0 ? result : null;
    } catch {
      return null;
    }
  }

  async getCivStats(
    mode: GameMode,
    _eloRange?: [number, number]
  ): Promise<CivStats[]> {
    // 1. Try accumulated JSON (persistent, updated daily by GitHub Actions)
    const accumulated = this.readAccumulatedStats(mode);
    if (accumulated) return accumulated;

    // 2. Fall back to live computation
    try {
      return await this.computeCivStatsFromMatches(mode);
    } catch {
      // 3. Last resort: mock data
      return this.mock.getCivStats(mode, _eloRange);
    }
  }

  /**
   * Compute civ win rates from recent match history.
   * Strategy: get top 50 leaderboard players via MS API, then fetch their
   * last 20 matches each from aoe2companion (up to 1000 matches total).
   * Cached in globalThis for 1 hour per (mode) key.
   */
  private async computeCivStatsFromMatches(mode: GameMode): Promise<CivStats[]> {
    const CACHE_KEY = `__aoe2_civstats_${mode}__`;
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour
    const g = globalThis as Record<string, unknown>;
    const cached = g[CACHE_KEY] as { data: CivStats[]; ts: number } | undefined;
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    // Step 1: Get top players from multiple leaderboard pages
    const modeParams = gameModeToParams(mode);
    const [lb1, lb2, lb3] = await Promise.allSettled([
      this.fetchLeaderboard({ ...modeParams, searchPlayer: "", page: 1, count: 50 }),
      this.fetchLeaderboard({ ...modeParams, searchPlayer: "", page: 2, count: 50 }),
      this.fetchLeaderboard({ ...modeParams, searchPlayer: "", page: 3, count: 50 }),
    ]);
    const profileIds = [
      ...(lb1.status === "fulfilled" ? (lb1.value.items ?? []) : []),
      ...(lb2.status === "fulfilled" ? (lb2.value.items ?? []) : []),
      ...(lb3.status === "fulfilled" ? (lb3.value.items ?? []) : []),
    ].map((p) => p.rlUserId).filter(Boolean);

    if (profileIds.length === 0) throw new Error("No players from leaderboard");

    // Step 2: Fetch last 30 matches for each player in parallel (batches of 10)
    const leaderboardId = gameModeToCompanionLeaderboard(mode);
    const BATCH_SIZE = 10;
    const MATCHES_PER_PLAYER = 30;

    const fetchPlayerMatches = (profileId: number) =>
      fetch(
        `${COMPANION_API}/matches?profile_ids=${profileId}&count=${MATCHES_PER_PLAYER}`,
        { headers: { "User-Agent": "AoE2Insights/1.0" }, next: { revalidate: 3600 } }
      )
        .then((r) => r.json() as Promise<CompanionMatchesResponse>)
        .catch(() => ({ matches: [] } as CompanionMatchesResponse));

    // Process in batches to avoid overwhelming the API
    const allMatches: CompanionMatch[] = [];
    for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
      const batch = profileIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(fetchPlayerMatches));
      for (const r of results) {
        if (r.status === "fulfilled") {
          // Filter to only the requested game mode
          const filtered = (r.value?.matches ?? []).filter(
            (m) => m.leaderboardId === leaderboardId
          );
          allMatches.push(...filtered);
        }
      }
    }

    // Step 3: Deduplicate matches by matchId
    const seen = new Set<string>();
    const uniqueMatches = allMatches.filter((m) => {
      const key = String(m.matchId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Step 4: Tally wins/games per civ
    const civMap = new Map<string, { wins: number; games: number; ratingSum: number }>();
    for (const match of uniqueMatches) {
      for (const team of match.teams ?? []) {
        for (const player of team.players ?? []) {
          const name = capitalizeCivName(player.civName || player.civ);
          if (!name) continue;
          const entry = civMap.get(name) ?? { wins: 0, games: 0, ratingSum: 0 };
          entry.games++;
          if (player.won) entry.wins++;
          if (player.rating) entry.ratingSum += player.rating;
          civMap.set(name, entry);
        }
      }
    }

    const totalGames = [...civMap.values()].reduce((s, v) => s + v.games, 0);

    const result = [...civMap.entries()]
      .filter(([, v]) => v.games >= 3)
      .map(([civName, v], idx) => ({
        civId: idx,
        civName,
        winRate: (v.wins / v.games) * 100,
        playRate: (v.games / totalGames) * 100,
        avgRating: v.ratingSum / v.games,
        totalGames: v.games,
      }))
      .sort((a, b) => b.winRate - a.winRate);

    g[CACHE_KEY] = { data: result, ts: Date.now() };
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP STATS  (computed from aoe2companion match data — includes all DLC civs)
  // ═══════════════════════════════════════════════════════════════════════════

  async getMapStats(mode: GameMode): Promise<MapStats[]> {
    try {
      const CACHE_KEY = `__aoe2_mapstats_${mode}__`;
      const CACHE_TTL = 60 * 60 * 1000;
      const g = globalThis as Record<string, unknown>;
      const cached = g[CACHE_KEY] as { data: MapStats[]; ts: number } | undefined;
      if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

      // Reuse civ stats computation — fetch same match dataset
      const modeParams = gameModeToParams(mode);
      const lbRes = await this.fetchLeaderboard({ ...modeParams, searchPlayer: "", page: 1, count: 50 });
      const profileIds = (lbRes.items ?? []).map((p) => p.rlUserId).filter(Boolean);
      if (profileIds.length === 0) return [];

      const leaderboardId = gameModeToCompanionLeaderboard(mode);
      const BATCH_SIZE = 10;
      const allMatches: CompanionMatch[] = [];
      for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
        const batch = profileIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map((pid) =>
          fetch(
            `${COMPANION_API}/matches?profile_ids=${pid}&count=20`,
            { headers: { "User-Agent": "AoE2Insights/1.0" }, next: { revalidate: 3600 } }
          ).then((r) => r.json() as Promise<CompanionMatchesResponse>).catch(() => ({ matches: [] }))
        ));
        for (const r of results) {
          if (r.status === "fulfilled") {
            const filtered = (r.value?.matches ?? []).filter((m) => m.leaderboardId === leaderboardId);
            allMatches.push(...filtered);
          }
        }
      }
      // Deduplicate
      const seen2 = new Set<string>();
      const uniqueMatches2 = allMatches.filter((m) => {
        const key = String(m.matchId);
        if (seen2.has(key)) return false;
        seen2.add(key);
        return true;
      });

      // map slug → civ name → { wins, games }
      type CivEntry = { wins: number; games: number };
      const mapIndex = new Map<string, Map<string, CivEntry>>();
      const mapTotals = new Map<string, number>();

      for (const match of uniqueMatches2) {
          const rawMap = match.mapName?.toLowerCase().replace(/\s+/g, "_") ?? "";
          if (!rawMap) continue;
          if (!mapIndex.has(rawMap)) mapIndex.set(rawMap, new Map());
          const civMap = mapIndex.get(rawMap)!;
          mapTotals.set(rawMap, (mapTotals.get(rawMap) ?? 0) + 1);

          for (const team of match.teams ?? []) {
            for (const player of team.players ?? []) {
              const civName = capitalizeCivName(player.civName || player.civ);
              if (!civName) continue;
              const entry = civMap.get(civName) ?? { wins: 0, games: 0 };
              entry.games++;
              if (player.won) entry.wins++;
              civMap.set(civName, entry);
            }
          }
      }

      const result = Array.from(mapIndex.entries())
        .filter(([, civs]) => {
          const total = [...civs.values()].reduce((s, v) => s + v.games, 0);
          return total >= 50;
        })
        .map(([mapSlug, civMap]) => {
          const totalGames = mapTotals.get(mapSlug) ?? 0;
          const civs = [...civMap.entries()]
            .filter(([, v]) => v.games >= 10)
            .map(([civName, v]) => ({
              civName,
              winRate: (v.wins / v.games) * 100,
              numGames: v.games,
              playRate: (v.games / (totalGames * 2)) * 100,
            }))
            .sort((a, b) => b.winRate - a.winRate);

          return {
            mapName: capitalizeCivName(mapSlug),
            mapSlug,
            totalGames,
            topCivs: civs.slice(0, 5),
            bottomCivs: civs.slice(-5).reverse(),
          };
        })
        .sort((a, b) => b.totalGames - a.totalGames);

      g[CACHE_KEY] = { data: result, ts: Date.now() };
      return result;
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CIV PATCH HISTORY  (aoestats.io — last 6 patches)
  // ═══════════════════════════════════════════════════════════════════════════

  async getCivPatchHistory(civSlug: string, mode: GameMode = "rm-1v1"): Promise<CivPatchPoint[]> {
    try {
      const grouping = gameModeToAoestatsGrouping(mode);

      // Get all valid patches
      const patchRes = await fetch("https://aoestats.io/api/patches/", {
        headers: { Accept: "*/*" },
        next: { revalidate: 21600 },
      });
      const patchList = await patchRes.json() as Array<{ number: number; label: string; total_games: number }>;
      const validPatches = patchList
        .filter((p) => p.total_games > 0)
        .sort((a, b) => b.number - a.number)
        .slice(0, 6); // last 6 patches

      // Fetch all patches in parallel
      const results = await Promise.all(
        validPatches.map((p) =>
          fetch(
            `https://aoestats.io/api/stats/?patch=${p.number}&grouping=${grouping}&elo_range=all`,
            { headers: { Accept: "*/*", "User-Agent": "AoE2Insights/1.0" }, next: { revalidate: 3600 } }
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((data: AoestatsStatsEntry[] | null) => ({ patch: p, data }))
        )
      );

      return results
        .map(({ patch, data }) => {
          const civStats = data?.[0]?.civ_stats ?? {};
          const civKey = Object.keys(civStats).find(
            (k) => k === civSlug || civStats[k].civ_name?.replace(/\s+/g, "_") === civSlug
          );
          const civ = civKey ? civStats[civKey] : null;
          if (!civ || civ.num_games < 50) return null;
          return {
            patch: String(patch.number),
            patchLabel: patch.label.split(" ").slice(-1)[0] ?? patch.label, // "12/2" short format
            winRate: civ.win_rate * 100,
            numGames: civ.num_games,
            rank: civ.rank,
          };
        })
        .filter((p): p is CivPatchPoint => p !== null)
        .reverse(); // oldest → newest for chart
    } catch {
      return [];
    }
  }

  /** Cache the latest patch number for 6 hours */
  private async getLatestAoestatsPatch(): Promise<number> {
    const CACHE_KEY = "__aoe2_latest_patch__";
    const PATCH_TTL = 6 * 60 * 60 * 1000;
    const g = globalThis as Record<string, unknown>;
    const cached = g[CACHE_KEY] as { patch: number; ts: number } | undefined;
    if (cached && Date.now() - cached.ts < PATCH_TTL) return cached.patch;

    try {
      const res = await fetch("https://aoestats.io/api/patches/", {
        headers: { "Accept": "*/*" },
        next: { revalidate: 21600 },
      });
      if (res.ok) {
        const patches = await res.json() as Array<{ number: number; total_games: number }>;
        const valid = patches
          .filter((p) => p.total_games > 0)
          .sort((a, b) => b.number - a.number);
        if (valid.length > 0) {
          g[CACHE_KEY] = { patch: valid[0].number, ts: Date.now() };
          return valid[0].number;
        }
      }
    } catch { /* fall through */ }

    return 162286; // known-good fallback
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private findPlayerInCompanionMatch(
    m: CompanionMatch,
    profileId: number
  ): CompanionPlayer | null {
    for (const team of m.teams ?? []) {
      for (const p of team.players ?? []) {
        if (p.profileId === profileId) return p;
      }
    }
    return null;
  }

  private companionMatchToMatch(m: CompanionMatch, _contextProfileId: number): Match {
    const allPlayers: MatchPlayer[] = [];
    for (const team of m.teams ?? []) {
      for (const p of team.players ?? []) {
        allPlayers.push({
          profileId: p.profileId,
          name: p.name,
          civ: 0,
          civName: p.civName || p.civ,
          team: p.team ?? team.teamId,
          color: p.color,
          rating: p.rating,
          ratingChange: p.ratingDiff,
          won: p.won,
          country: p.country,
        });
      }
    }

    const started = Math.floor(new Date(m.started).getTime() / 1000);
    const finished = m.finished
      ? Math.floor(new Date(m.finished).getTime() / 1000)
      : undefined;

    const gameMode = companionIdToGameMode(m.leaderboardId);

    return {
      matchId: String(m.matchId),
      started,
      finished,
      mapType: 0,
      mapName: m.mapName,
      gameMode,
      ranked: m.leaderboard !== "unranked",
      players: allPlayers,
    };
  }

  async getMetaReport(mode: GameMode = "rm-1v1"): Promise<MetaReport> {
    try {
      // Compare "this week" vs "last week" by fetching two non-overlapping batches
      // Pages 1-4 = recent matches (current), pages 7-10 = older matches (previous)
      // Get two sets of players (different pages) to simulate "current" vs "previous"
      const modeParams2 = gameModeToParams(mode);
      const leaderboardId = gameModeToCompanionLeaderboard(mode);

      const [lbPage1, lbPage2] = await Promise.all([
        this.fetchLeaderboard({ ...modeParams2, searchPlayer: "", page: 1, count: 30 }),
        this.fetchLeaderboard({ ...modeParams2, searchPlayer: "", page: 2, count: 30 }),
      ]);
      const currentIds = (lbPage1.items ?? []).map((p) => p.rlUserId).filter(Boolean);
      const previousIds = (lbPage2.items ?? []).map((p) => p.rlUserId).filter(Boolean);

      const fetchMatchesForIds = async (ids: number[], matchCount = 15) => {
        const allM: CompanionMatch[] = [];
        for (let i = 0; i < ids.length; i += 10) {
          const batch = ids.slice(i, i + 10);
          const results = await Promise.allSettled(batch.map((pid) =>
            fetch(
              `${COMPANION_API}/matches?profile_ids=${pid}&count=${matchCount}`,
              { headers: { "User-Agent": "AoE2Insights/1.0" }, next: { revalidate: 3600 } }
            ).then((r) => r.json() as Promise<CompanionMatchesResponse>).catch(() => ({ matches: [] }))
          ));
          for (const r of results) {
            if (r.status === "fulfilled") {
              const filtered = (r.value?.matches ?? []).filter((m) => m.leaderboardId === leaderboardId);
              allM.push(...filtered);
            }
          }
        }
        // Dedup
        const s = new Set<string>();
        return allM.filter((m) => { const k = String(m.matchId); if (s.has(k)) return false; s.add(k); return true; });
      };

      const tallyCivs = (matches: CompanionMatch[]) => {
        const m = new Map<string, { wins: number; games: number }>();
        for (const match of matches) {
          for (const team of match.teams ?? []) {
            for (const player of team.players ?? []) {
              const civName = capitalizeCivName(player.civName || player.civ);
              if (!civName) continue;
              const entry = m.get(civName) ?? { wins: 0, games: 0 };
              entry.games++;
              if (player.won) entry.wins++;
              m.set(civName, entry);
            }
          }
        }
        return m;
      };

      const [currentMatches, previousMatches] = await Promise.all([
        fetchMatchesForIds(currentIds),
        fetchMatchesForIds(previousIds),
      ]);

      const currentMap = tallyCivs(currentMatches);
      const previousMap = tallyCivs(previousMatches);

      // Rank civs in current period
      const currentRanked = [...currentMap.entries()]
        .filter(([, v]) => v.games >= 10)
        .map(([civName, v]) => ({ civName, winRate: (v.wins / v.games) * 100, games: v.games }))
        .sort((a, b) => b.winRate - a.winRate);

      const changes: CivChange[] = currentRanked.map((curr, idx) => {
        const prev = previousMap.get(curr.civName);
        const prevWR = prev && prev.games >= 10 ? (prev.wins / prev.games) * 100 : curr.winRate;
        const currentRank = idx + 1;
        const prevRanked = [...previousMap.entries()]
          .filter(([, v]) => v.games >= 10)
          .map(([n, v]) => ({ n, wr: (v.wins / v.games) * 100 }))
          .sort((a, b) => b.wr - a.wr);
        const previousRank = prevRanked.findIndex((p) => p.n === curr.civName) + 1 || currentRank;

        return {
          civName: curr.civName,
          currentWinRate: curr.winRate,
          previousWinRate: prevWR,
          change: curr.winRate - prevWR,
          currentRank,
          previousRank,
          rankChange: previousRank - currentRank,
          totalGames: curr.games,
        };
      }).sort((a, b) => b.change - a.change);

      // Use aoestats patch labels for display (just the label, not the actual data)
      let currentPatchLabel = "Recent (7 days)";
      let previousPatchLabel = "Previous (7 days)";
      let currentPatchId = "recent";
      let previousPatchId = "previous";
      try {
        const patchRes = await fetch("https://aoestats.io/api/patches/", {
          headers: { Accept: "*/*" },
          next: { revalidate: 21600 },
        });
        if (patchRes.ok) {
          const patches = await patchRes.json() as Array<{ number: number; label: string; total_games: number }>;
          const valid = patches.filter((p) => p.total_games > 0).sort((a, b) => b.number - a.number);
          if (valid[0]) { currentPatchLabel = valid[0].label; currentPatchId = String(valid[0].number); }
          if (valid[1]) { previousPatchLabel = valid[1].label; previousPatchId = String(valid[1].number); }
        }
      } catch { /* use default labels */ }

      return {
        currentPatch: currentPatchId,
        previousPatch: previousPatchId,
        currentPatchLabel,
        previousPatchLabel,
        biggestRisers: changes.slice(0, 8),
        biggestFallers: changes.slice(-8).reverse(),
        allChanges: changes,
      };
    } catch {
      return {
        currentPatch: "recent",
        previousPatch: "previous",
        currentPatchLabel: "Recent",
        previousPatchLabel: "Previous",
        biggestRisers: [],
        biggestFallers: [],
        allChanges: [],
      };
    }
  }
}

