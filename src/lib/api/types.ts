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
}
