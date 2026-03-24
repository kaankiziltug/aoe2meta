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
import { CIVILIZATIONS, MAPS } from "../constants";

const PRO_PLAYERS: {
  profileId: number;
  name: string;
  country: string;
  rating: number;
  clan?: string;
}[] = [
  { profileId: 1001, name: "TheViper", country: "NO", rating: 2680, clan: "GL" },
  { profileId: 1002, name: "Hera", country: "CA", rating: 2650, clan: "GL" },
  { profileId: 1003, name: "Liereyy", country: "AT", rating: 2620 },
  { profileId: 1004, name: "MbL", country: "NO", rating: 2580, clan: "GL" },
  { profileId: 1005, name: "DauT", country: "DE", rating: 2540, clan: "GL" },
  { profileId: 1006, name: "TaToH", country: "ES", rating: 2520 },
  { profileId: 1007, name: "Yo", country: "CN", rating: 2560 },
  { profileId: 1008, name: "ACCM", country: "VN", rating: 2490 },
  { profileId: 1009, name: "Vinchester", country: "FI", rating: 2480 },
  { profileId: 1010, name: "Villese", country: "FI", rating: 2470 },
  { profileId: 1011, name: "Barles", country: "BR", rating: 2450 },
  { profileId: 1012, name: "classicpro", country: "DE", rating: 2440 },
  { profileId: 1013, name: "JorDan", country: "DE", rating: 2430 },
  { profileId: 1014, name: "Sitaux", country: "FR", rating: 2420 },
  { profileId: 1015, name: "Capoch", country: "AR", rating: 2410 },
  { profileId: 1016, name: "Hearttt", country: "VN", rating: 2400 },
  { profileId: 1017, name: "Mr_Yo", country: "CN", rating: 2390 },
  { profileId: 1018, name: "Nicov", country: "AR", rating: 2380 },
  { profileId: 1019, name: "Slam", country: "US", rating: 2370 },
  { profileId: 1020, name: "Miguel", country: "BR", rating: 2360 },
  { profileId: 1021, name: "Survivalist", country: "US", rating: 2340 },
  { profileId: 1022, name: "BacT", country: "VN", rating: 2330 },
  { profileId: 1023, name: "Dogao", country: "BR", rating: 2320 },
  { profileId: 1024, name: "Rubenstock", country: "ES", rating: 2310 },
  { profileId: 1025, name: "Spring", country: "CN", rating: 2300 },
  { profileId: 1026, name: "Vivi", country: "CN", rating: 2290 },
  { profileId: 1027, name: "Tim", country: "CN", rating: 2280 },
  { profileId: 1028, name: "Daniel", country: "DE", rating: 2270 },
  { profileId: 1029, name: "Kasva", country: "FI", rating: 2260 },
  { profileId: 1030, name: "Lierey", country: "AT", rating: 2250 },
  { profileId: 1031, name: "Paladin", country: "GB", rating: 2240 },
  { profileId: 1032, name: "Modri", country: "SE", rating: 2230 },
  { profileId: 1033, name: "Mista", country: "PL", rating: 2220 },
  { profileId: 1034, name: "Saymyname", country: "CA", rating: 2210 },
  { profileId: 1035, name: "F1Re", country: "BR", rating: 2200 },
  { profileId: 1036, name: "DracKeN", country: "ES", rating: 2190 },
  { profileId: 1037, name: "Lyx", country: "CN", rating: 2180 },
  { profileId: 1038, name: "BruH", country: "DE", rating: 2170 },
  { profileId: 1039, name: "Hoang", country: "VN", rating: 2160 },
  { profileId: 1040, name: "Larry", country: "US", rating: 2150 },
  { profileId: 1041, name: "AngelinaJolie", country: "KR", rating: 2140 },
  { profileId: 1042, name: "Cloud", country: "JP", rating: 2130 },
  { profileId: 1043, name: "Aftermath", country: "AU", rating: 2120 },
  { profileId: 1044, name: "Stark", country: "TR", rating: 2110 },
  { profileId: 1045, name: "Blade", country: "RU", rating: 2100 },
  { profileId: 1046, name: "Falcon", country: "SE", rating: 2090 },
  { profileId: 1047, name: "Kamigawa", country: "JP", rating: 2080 },
  { profileId: 1048, name: "Phoenix", country: "KR", rating: 2070 },
  { profileId: 1049, name: "Ranger", country: "AU", rating: 2060 },
  { profileId: 1050, name: "Storm", country: "PL", rating: 2050 },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateRatingHistory(
  baseRating: number,
  profileId: number
): RatingPoint[] {
  const rand = seededRandom(profileId);
  const points: RatingPoint[] = [];
  let rating = baseRating - 400;
  let wins = 0;
  let losses = 0;
  const now = Math.floor(Date.now() / 1000);
  const sixMonthsAgo = now - 180 * 24 * 3600;

  for (let i = 0; i < 120; i++) {
    const change = Math.floor(rand() * 30) - 12;
    rating = Math.max(800, Math.min(3000, rating + change));
    if (change > 0) wins++;
    else losses++;
    points.push({
      rating,
      timestamp: sixMonthsAgo + i * (180 * 24 * 3600) / 120,
      numWins: wins,
      numLosses: losses,
      streak: change > 0 ? Math.floor(rand() * 5) + 1 : -Math.floor(rand() * 3) - 1,
    });
  }
  return points;
}

function generateMatches(
  profileId: number,
  playerName: string,
  count: number
): Match[] {
  const rand = seededRandom(profileId * 7);
  const matches: Match[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    const civ1 = CIVILIZATIONS[Math.floor(rand() * CIVILIZATIONS.length)];
    const civ2 = CIVILIZATIONS[Math.floor(rand() * CIVILIZATIONS.length)];
    const map = MAPS[Math.floor(rand() * MAPS.length)];
    const won = rand() > 0.45;
    const opponent =
      PRO_PLAYERS[Math.floor(rand() * PRO_PLAYERS.length)];
    const started = now - i * 3600 * 2 - Math.floor(rand() * 3600);

    matches.push({
      matchId: `m-${profileId}-${i}`,
      started,
      finished: started + 1200 + Math.floor(rand() * 2400),
      mapType: MAPS.indexOf(map),
      mapName: map,
      gameMode: "rm-1v1",
      ranked: true,
      players: [
        {
          profileId,
          name: playerName,
          civ: civ1.id,
          civName: civ1.name,
          team: 1,
          color: 1,
          rating: 2400 + Math.floor(rand() * 200),
          ratingChange: won ? Math.floor(rand() * 16) + 4 : -(Math.floor(rand() * 16) + 4),
          won,
          country:
            PRO_PLAYERS.find((p) => p.profileId === profileId)?.country,
        },
        {
          profileId: opponent.profileId,
          name: opponent.name,
          civ: civ2.id,
          civName: civ2.name,
          team: 2,
          color: 2,
          rating: opponent.rating + Math.floor(rand() * 100) - 50,
          ratingChange: won ? -(Math.floor(rand() * 16) + 4) : Math.floor(rand() * 16) + 4,
          won: !won,
          country: opponent.country,
        },
      ],
    });
  }
  return matches;
}

export class MockDataProvider implements AoE2DataProvider {
  async searchPlayers(query: string): Promise<Player[]> {
    const q = query.toLowerCase();
    return PRO_PLAYERS.filter((p) => p.name.toLowerCase().includes(q)).map(
      (p) => ({
        profileId: p.profileId,
        name: p.name,
        country: p.country,
        clan: p.clan,
        lastMatchTime: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
        ratings: {
          "rm-1v1": p.rating,
          "rm-team": p.rating - 100 + Math.floor(Math.random() * 200),
        },
      })
    );
  }

  async getLeaderboard(
    mode: GameMode,
    start: number,
    count: number
  ): Promise<LeaderboardResponse> {
    const rand = seededRandom(mode.length * 100 + start);
    const modeOffset =
      mode === "rm-1v1" ? 0 : mode === "rm-team" ? -50 : mode === "ew-1v1" ? -80 : -120;

    const sorted = [...PRO_PLAYERS].sort((a, b) => b.rating - a.rating);
    const entries: LeaderboardEntry[] = sorted
      .slice(start, start + count)
      .map((p, i) => ({
        rank: start + i + 1,
        profileId: p.profileId,
        name: p.name,
        rating: p.rating + modeOffset + Math.floor(rand() * 40) - 20,
        highestRating: p.rating + modeOffset + 50 + Math.floor(rand() * 100),
        games: 500 + Math.floor(rand() * 2000),
        wins: 0,
        losses: 0,
        streak: Math.floor(rand() * 10) - 4,
        lastMatch:
          Math.floor(Date.now() / 1000) - Math.floor(rand() * 172800),
        country: p.country,
      }));

    entries.forEach((e) => {
      const wr = 0.48 + rand() * 0.12;
      e.wins = Math.floor(e.games * wr);
      e.losses = e.games - e.wins;
    });

    return {
      total: PRO_PLAYERS.length,
      start,
      count: entries.length,
      entries,
    };
  }

  async getPlayerProfile(profileId: number): Promise<PlayerProfile> {
    const player = PRO_PLAYERS.find((p) => p.profileId === profileId);
    if (!player) throw new Error("Player not found");

    const rand = seededRandom(profileId * 13);
    const totalGames = 800 + Math.floor(rand() * 2000);
    const totalWins = Math.floor(totalGames * (0.5 + rand() * 0.1));
    const matches = generateMatches(profileId, player.name, 20);

    const bestCivs = CIVILIZATIONS.slice(0, 8).map((c) => ({
      civId: c.id,
      civName: c.name,
      winRate: 45 + rand() * 20,
      games: 20 + Math.floor(rand() * 100),
    }));
    bestCivs.sort((a, b) => b.winRate - a.winRate);

    const bestMaps = MAPS.slice(0, 6).map((m) => ({
      mapName: m,
      winRate: 42 + rand() * 22,
      games: 10 + Math.floor(rand() * 80),
    }));
    bestMaps.sort((a, b) => b.winRate - a.winRate);

    return {
      profileId: player.profileId,
      name: player.name,
      country: player.country,
      clan: player.clan,
      lastMatchTime: matches[0]?.started,
      ratings: {
        "rm-1v1": player.rating,
        "rm-team": player.rating - 80 + Math.floor(rand() * 60),
        "ew-1v1": player.rating - 120 + Math.floor(rand() * 80),
      },
      totalGames,
      totalWins,
      bestCivs,
      bestMaps,
      recentMatches: matches,
    };
  }

  async getRatingHistory(
    profileId: number,
    _mode: GameMode
  ): Promise<RatingPoint[]> {
    const player = PRO_PLAYERS.find((p) => p.profileId === profileId);
    if (!player) throw new Error("Player not found");
    return generateRatingHistory(player.rating, profileId);
  }

  async getMatchHistory(
    profileId: number,
    start: number,
    count: number
  ): Promise<Match[]> {
    const player = PRO_PLAYERS.find((p) => p.profileId === profileId);
    if (!player) throw new Error("Player not found");
    const allMatches = generateMatches(profileId, player.name, 50);
    return allMatches.slice(start, start + count);
  }

  async getCivStats(
    _mode: GameMode,
    _eloRange?: [number, number]
  ): Promise<CivStats[]> {
    const rand = seededRandom(42);
    return CIVILIZATIONS.map((c) => ({
      civId: c.id,
      civName: c.name,
      playRate: 1 + rand() * 8,
      winRate: 44 + rand() * 14,
      avgRating: 1200 + Math.floor(rand() * 600),
      totalGames: 500 + Math.floor(rand() * 5000),
    }));
  }
}
