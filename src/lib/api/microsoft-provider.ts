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
  CivStats,
  GameMode,
  LeaderboardEntry,
  LeaderboardResponse,
  Match,
  MatchPlayer,
  Player,
  PlayerProfile,
  RatingPoint,
} from "./types";
import { MockDataProvider } from "./mock-data";

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
  win_rate: number;
  play_rate: number;
  num_games: number;
  wins: number;
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
    const data = await this.fetchLeaderboard({
      versus: "players",
      matchType: "ranked",
      teamSize: "1v1",
      searchPlayer: query,
      page: 1,
      count: 100,
    });
    const items = data.items ?? [];
    cachePlayers(items);
    return items
      .sort((a, b) => (b.elo || b.eloHighest) - (a.elo || a.eloHighest))
      .slice(0, 20)
      .map((item) => ({
        profileId: item.rlUserId,
        name: item.userName,
        ratings: { "rm-1v1": item.elo || item.eloHighest },
      }));
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
  // CIV STATS  (aoestats.io — ~1.1MB per request, cached 1 hour)
  // ═══════════════════════════════════════════════════════════════════════════

  async getCivStats(
    mode: GameMode,
    eloRange?: [number, number]
  ): Promise<CivStats[]> {
    try {
      const grouping = gameModeToAoestatsGrouping(mode);
      const eloGroup = eloRangeToAoestatsGroup(eloRange);
      const patch = await this.getLatestAoestatsPatch();

      const url = `https://aoestats.io/api/stats/?patch=${patch}&grouping=${grouping}&elo_range=${eloGroup}`;

      const res = await fetch(url, {
        // Must NOT send Accept: application/json — aoestats returns 405 with it
        headers: { "Accept": "*/*", "User-Agent": "AoE2Insights/1.0" },
        next: { revalidate: 3600 }, // cache 1 hour
      });

      if (!res.ok) throw new Error(`aoestats ${res.status}`);

      const data = await res.json() as AoestatsStatsEntry[];
      if (!data?.[0]?.civ_stats) throw new Error("Unexpected structure");

      const civStats = data[0].civ_stats;
      const totalGames = data[0].total_games;

      return Object.entries(civStats)
        .filter(([, civ]) => civ.num_games >= 100)
        .map(([, civ]) => ({
          civId: 0,
          civName: capitalizeCivName(civ.civ_name),
          winRate: civ.win_rate * 100,
          playRate: civ.play_rate * 100,
          avgRating: 0,
          totalGames: civ.num_games,
        }))
        .sort((a, b) => b.winRate - a.winRate);
    } catch {
      // Fallback to mock on error
      return this.mock.getCivStats(mode, eloRange);
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
}

