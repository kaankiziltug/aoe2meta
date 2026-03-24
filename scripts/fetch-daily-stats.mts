// scripts/fetch-daily-stats.mts
// Run with: npm run stats:fetch
// Fetches recent matches for top 200 leaderboard players and accumulates
// civ win/loss tallies into src/data/civ-stats-accumulated.json

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Constants ──────────────────────────────────────────────────────────────

const MS_API = "https://api.ageofempires.com/api/v2/ageii";
const COMPANION_API = "https://data.aoe2companion.com/api";

const DATA_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/data/civ-stats-accumulated.json"
);

const MODES_TO_FETCH = ["rm-1v1", "rm-team", "ew-1v1", "ew-team"] as const;
type Mode = (typeof MODES_TO_FETCH)[number];

const COMPANION_LEADERBOARD: Record<Mode, string> = {
  "rm-1v1":  "rm_1v1",
  "rm-team": "rm_team",
  "ew-1v1":  "ew_1v1",
  "ew-team": "ew_team",
};

const MS_PARAMS: Record<Mode, { versus: string; matchType: string; teamSize: string }> = {
  "rm-1v1":  { versus: "players", matchType: "ranked",   teamSize: "1v1" },
  "rm-team": { versus: "team",    matchType: "ranked",   teamSize: "2v2" },
  "ew-1v1":  { versus: "players", matchType: "unranked", teamSize: "1v1" },
  "ew-team": { versus: "team",    matchType: "unranked", teamSize: "2v2" },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface CivRecord { wins: number; games: number }

interface AccumulatedData {
  lastFetch: string;
  totalMatches: number;
  modes: Record<string, Record<string, CivRecord>>;
}

interface CompanionPlayer {
  civName: string;
  civ: string;
  won: boolean;
  rating: number;
}

interface CompanionMatch {
  matchId: number;
  started: string;
  leaderboardId: string;
  teams: { players: CompanionPlayer[] }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function capitalizeCivName(name: string): string {
  if (!name) return "";
  return name
    .split(/[\s_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchLeaderboardPage(
  params: { versus: string; matchType: string; teamSize: string },
  page: number
): Promise<number[]> {
  const res = await fetch(`${MS_API}/Leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ region: 7, ...params, searchPlayer: "", page, count: 50 }),
  });
  if (!res.ok) throw new Error(`MS Leaderboard HTTP ${res.status}`);
  const data = await res.json() as { items?: { rlUserId: number }[] };
  return (data.items ?? []).map((p) => p.rlUserId).filter(Boolean);
}

async function fetchPlayerMatches(
  profileId: number,
  count: number
): Promise<CompanionMatch[]> {
  try {
    const res = await fetch(
      `${COMPANION_API}/matches?profile_ids=${profileId}&count=${count}`,
      { headers: { "User-Agent": "AoE2Insights/1.0" } }
    );
    if (!res.ok) return [];
    const data = await res.json() as { matches?: CompanionMatch[] };
    return data.matches ?? [];
  } catch {
    return [];
  }
}

// ── Core logic ─────────────────────────────────────────────────────────────

async function processModeUpdate(
  mode: Mode,
  lastFetch: Date,
  existingCivs: Record<string, CivRecord>
): Promise<{ civs: Record<string, CivRecord>; newMatchCount: number }> {
  const params = MS_PARAMS[mode];
  const leaderboardId = COMPANION_LEADERBOARD[mode];
  const lastFetchTime = lastFetch.toISOString();

  // Sample from spread ELO brackets: top, mid-high, mid, average, lower
  // With ~45K players and 50/page: page 1=rank 1-50, page 100=rank 4951-5000, page 400=rank 19951-20000
  const SAMPLE_PAGES = [1, 5, 20, 50, 100, 200, 350, 500];
  console.log(`  [${mode}] Fetching leaderboard (${SAMPLE_PAGES.length} spread pages covering all ELO brackets)...`);
  const pages = await Promise.allSettled(
    SAMPLE_PAGES.map((p) => fetchLeaderboardPage(params, p))
  );

  const profileIds = pages.flatMap((p) =>
    p.status === "fulfilled" ? p.value : []
  );
  const uniqueIds = [...new Set(profileIds)];
  console.log(`  [${mode}] Got ${uniqueIds.length} unique players`);

  if (uniqueIds.length === 0) {
    console.warn(`  [${mode}] No players found, skipping`);
    return { civs: existingCivs, newMatchCount: 0 };
  }

  const BATCH_SIZE = 10;
  const MATCHES_PER_PLAYER = 30;
  const allMatches: CompanionMatch[] = [];

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => fetchPlayerMatches(id, MATCHES_PER_PLAYER))
    );
    for (const r of results) {
      if (r.status === "fulfilled") allMatches.push(...r.value);
    }
    if (i + BATCH_SIZE < uniqueIds.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`  [${mode}] Fetched ${allMatches.length} raw match entries`);

  // Filter: correct mode, newer than lastFetch, deduplicate by matchId
  const seen = new Set<string>();
  const newMatches = allMatches.filter((m) => {
    if (m.leaderboardId !== leaderboardId) return false;
    if (m.started <= lastFetchTime) return false;
    const key = String(m.matchId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`  [${mode}] ${newMatches.length} new unique matches since ${lastFetchTime}`);

  const updated = { ...existingCivs };
  for (const match of newMatches) {
    for (const team of match.teams ?? []) {
      for (const player of team.players ?? []) {
        const name = capitalizeCivName(player.civName || player.civ);
        if (!name || name.startsWith("[")) continue;
        const rec = updated[name] ?? { wins: 0, games: 0 };
        rec.games++;
        if (player.won) rec.wins++;
        updated[name] = rec;
      }
    }
  }

  return { civs: updated, newMatchCount: newMatches.length };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== AoE2Meta daily stats fetch ===");
  console.log(`Data file: ${DATA_FILE}`);

  let data: AccumulatedData;
  try {
    if (existsSync(DATA_FILE)) {
      data = JSON.parse(readFileSync(DATA_FILE, "utf-8")) as AccumulatedData;
      console.log(`Loaded existing data: ${data.totalMatches} total matches, last fetch: ${data.lastFetch}`);
    } else {
      throw new Error("File not found");
    }
  } catch {
    console.warn("Starting fresh accumulation from epoch");
    data = {
      lastFetch: new Date(0).toISOString(),
      totalMatches: 0,
      modes: {},
    };
  }

  const lastFetch = new Date(data.lastFetch);
  const runStart = new Date();
  let totalNewMatches = 0;

  for (const mode of MODES_TO_FETCH) {
    console.log(`\nProcessing: ${mode}`);
    try {
      const existing = (data.modes[mode] ?? {}) as Record<string, CivRecord>;
      const { civs, newMatchCount } = await processModeUpdate(mode, lastFetch, existing);
      data.modes[mode] = civs;
      totalNewMatches += newMatchCount;
      const civCount = Object.keys(civs).length;
      console.log(`  [${mode}] Done. ${civCount} civs tracked, ${newMatchCount} new matches`);
    } catch (err) {
      console.error(`  [${mode}] Error:`, err);
    }
  }

  data.lastFetch = runStart.toISOString();
  data.totalMatches += totalNewMatches;

  console.log(`\n=== Summary ===`);
  console.log(`New matches this run: ${totalNewMatches}`);
  console.log(`Cumulative total: ${data.totalMatches}`);
  for (const mode of MODES_TO_FETCH) {
    const civs = data.modes[mode] ?? {};
    console.log(`  ${mode}: ${Object.keys(civs).length} civs`);
  }

  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log("\nData file updated successfully.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
