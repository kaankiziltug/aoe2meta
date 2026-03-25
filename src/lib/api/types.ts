export type GameMode =
  | "rm-1v1"
  | "rm-team"
  | "ew-1v1"
  | "ew-team"
  | "dm-1v1"
  | "dm-team"
  | "ror-1v1"
  | "ror-team";

export interface Player {
  profileId: number;
  steamId?: string;
  name: string;
  country?: string;
  clan?: string;
  lastMatchTime?: number;
  ratings?: Partial<Record<GameMode, number>>;
}

export interface LeaderboardEntry {
  rank: number;
  profileId: number;
  name: string;
  rating: number;
  highestRating: number;
  games: number;
  wins: number;
  losses: number;
  streak: number;
  lastMatch: number;
  country?: string;
}

export interface LeaderboardResponse {
  total: number;
  start: number;
  count: number;
  entries: LeaderboardEntry[];
}

export interface RatingPoint {
  rating: number;
  timestamp: number;
  numWins: number;
  numLosses: number;
  streak: number;
}

export interface Match {
  matchId: string;
  started: number;
  finished?: number;
  mapType: number;
  mapName: string;
  gameMode: GameMode;
  ranked: boolean;
  players: MatchPlayer[];
  server?: string;
}

export interface MatchPlayer {
  profileId: number;
  name: string;
  civ: number;
  civName: string;
  team: number;
  color: number;
  rating: number;
  ratingChange?: number;
  won?: boolean;
  country?: string;
}

export interface CivStats {
  civId: number;
  civName: string;
  playRate: number;
  winRate: number;
  avgRating: number;
  totalGames: number;
}

export interface CivMapStat {
  mapName: string;
  winRate: number;
  numGames: number;
  playRate: number;
}

export interface CivMatchupStat {
  civName: string;
  winRate: number;
  numGames: number;
}

export interface CivEloBreakdown {
  elo: string;
  eloLabel: string;
  winRate: number;
  numGames: number;
  playRate: number;
  rank: number;
}

export interface CivDetail {
  civName: string;
  civSlug: string;
  rank: number;
  winRate: number;
  playRate: number;
  totalGames: number;
  eloBreakdown: CivEloBreakdown[];
  topMaps: CivMapStat[];
  bottomMaps: CivMapStat[];
  bestMatchups: CivMatchupStat[];
  worstMatchups: CivMatchupStat[];
  byGameLength: { label: string; winRate: number; numGames: number }[];
  avgFeudalTime: number;
  avgCastleTime: number;
  avgImperialTime: number;
  avgGameLength: number;
}

export interface PlayerProfile extends Player {
  totalGames: number;
  totalWins: number;
  avatarUrl?: string;
  steamId?: string;
  verified?: boolean;
  twitchUrl?: string;
  youtubeUrl?: string;
  discordUrl?: string;
  liquipediaUrl?: string;
  bestCivs: { civId: number; civName: string; winRate: number; games: number }[];
  bestMaps: { mapName: string; winRate: number; games: number }[];
  recentMatches: Match[];
}

export interface MapCivStat {
  civName: string;
  winRate: number;
  numGames: number;
  playRate: number;
}

export interface MapStats {
  mapName: string;      // "Arabia"
  mapSlug: string;      // "arabia"
  totalGames: number;
  topCivs: MapCivStat[];    // top 5 civs by win rate (min 100 games)
  bottomCivs: MapCivStat[]; // bottom 5 civs
}

export interface CivPatchPoint {
  patch: string;
  patchLabel: string;
  winRate: number;
  numGames: number;
  rank: number;
}

export interface CivChange {
  civName: string;
  currentWinRate: number;
  previousWinRate: number;
  change: number; // positive = improved, negative = declined
  currentRank: number;
  previousRank: number;
  rankChange: number; // positive = climbed
  totalGames: number;
}

export interface MetaReport {
  currentPatch: string;
  previousPatch: string;
  currentPatchLabel: string;
  previousPatchLabel: string;
  biggestRisers: CivChange[];   // top 8 civs that improved most
  biggestFallers: CivChange[];  // top 8 civs that fell most
  allChanges: CivChange[];      // all civs sorted by change desc
}

export interface AoE2DataProvider {
  searchPlayers(query: string): Promise<Player[]>;
  getLeaderboard(
    mode: GameMode,
    start: number,
    count: number
  ): Promise<LeaderboardResponse>;
  getPlayerProfile(profileId: number): Promise<PlayerProfile>;
  getRatingHistory(
    profileId: number,
    mode: GameMode
  ): Promise<RatingPoint[]>;
  getMatchHistory(
    profileId: number,
    start: number,
    count: number
  ): Promise<Match[]>;
  getCivStats(
    mode: GameMode,
    eloRange?: [number, number]
  ): Promise<CivStats[]>;
  getCivDetail(civSlug: string, mode?: GameMode): Promise<CivDetail | null>;
  getMapStats(mode: GameMode, eloRange?: [number, number]): Promise<MapStats[]>;
  getCivPatchHistory(civSlug: string, mode?: GameMode): Promise<CivPatchPoint[]>;
  getMetaReport(mode?: GameMode): Promise<MetaReport>;
}
