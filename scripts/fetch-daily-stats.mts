// scripts/fetch-daily-stats.mts
// Run with: npm run stats:fetch
// Fetches recent matches from spread ELO brackets and writes a daily JSON file.
// Each file covers one calendar day (UTC). Old files (>31 days) are deleted.

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Constants ──────────────────────────────────────────────────────────────

const MS_API = "https://api.ageofempires.com/api/v2/ageii";
const COMPANION_API = "https://data.aoe2companion.com/api";

const DAILY_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/data/daily-stats"
);

const MODES_TO_FETCH = ["rm-1v1", "rm-team"] as const;
type Mode = (typeof MODES_TO_FETCH)[number];

const COMPANION_LEADERBOARD: Record<Mode, string> = {
  "rm-1v1": "rm_1v1",
  "rm-team": "rm_team",
};

const MS_PARAMS: Record<Mode, { versus: string; matchType: string; teamSize: string }> = {
  "rm-1v1": { versus: "players", matchType: "ranked", teamSize: "1v1" },
  "rm-team": { versus: "team", matchType: "ranked", teamSize: "2v2" },
};

// Spread ELO sampling: covers rank 1 → ~45,000
const SAMPLE_PAGES = [1, 3, 5, 8, 12, 16, 20, 25, 30, 40, 50, 70, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900];

const MATCHES_PER_PLAYER = 50;
const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 300;
const MAX_DAYS = 31;

// ── Types ──────────────────────────────────────────────────────────────────

interface DailyRecord {
  /** civ name */ c: string;
  /** won: 1 or 0 */ w: number;
  /** elo rating */ e: number;
}

interface DailyFile {
  date: string;
  fetchedAt: string;
  playerCount: number;
  modes: Record<string, {
    matchCount: number;
    records: DailyRecord[];
  }>;
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
  const data = (await res.json()) as { items?: { rlUserId: number }[] };
  return (data.items ?? []).map((p) => p.rlUserId).filter(Boolean);
}

async function fetchPlayerMatches(
  profileId: number,
  count: number
): Promise<CompanionMatch[]> {
  try {
    const res = await fetch(
      `${COMPANION_API}/matches?profile_ids=${profileId}&count=${count}`,
      { headers: { "User-Agent": "AoE2Meta/1.0" } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { matches?: CompanionMatch[] };
    return data.matches ?? [];
  } catch {
    return [];
  }
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Core logic ─────────────────────────────────────────────────────────────

/**
 * Fetch matches and group them by date (UTC).
 * Returns a Map<dateString, { matchCount, records }> so we can write multiple daily files.
 */
async function fetchModeDataByDate(
  mode: Mode,
  cutoffDate: string
): Promise<Map<string, { matchCount: number; records: DailyRecord[] }>> {
  const params = MS_PARAMS[mode];
  const leaderboardId = COMPANION_LEADERBOARD[mode];

  // 1. Fetch leaderboard pages (spread ELO)
  console.log(`  [${mode}] Fetching ${SAMPLE_PAGES.length} leaderboard pages...`);
  const pages = await Promise.allSettled(
    SAMPLE_PAGES.map((p) => fetchLeaderboardPage(params, p))
  );

  const profileIds = pages.flatMap((p) =>
    p.status === "fulfilled" ? p.value : []
  );
  const uniqueIds = [...new Set(profileIds)];
  console.log(`  [${mode}] ${uniqueIds.length} unique players`);

  const byDate = new Map<string, { matchCount: number; records: DailyRecord[] }>();

  if (uniqueIds.length === 0) return byDate;

  // 2. Fetch matches in batches
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
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
    const done = Math.min(i + BATCH_SIZE, uniqueIds.length);
    if (done % 150 === 0 || done === uniqueIds.length) {
      console.log(`  [${mode}] Fetched ${done}/${uniqueIds.length} players (${allMatches.length} raw matches)`);
    }
  }

  // 3. Filter & group by date
  const seen = new Set<string>();

  for (const m of allMatches) {
    if (m.leaderboardId !== leaderboardId) continue;
    if (m.started < cutoffDate) continue;
    const key = String(m.matchId);
    if (seen.has(key)) continue;
    seen.add(key);

    // Extract date from started timestamp
    const matchDate = m.started.slice(0, 10); // "YYYY-MM-DD"
    if (!byDate.has(matchDate)) {
      byDate.set(matchDate, { matchCount: 0, records: [] });
    }
    const bucket = byDate.get(matchDate)!;
    bucket.matchCount++;

    for (const team of m.teams ?? []) {
      for (const player of team.players ?? []) {
        const name = capitalizeCivName(player.civName || player.civ);
        if (!name || name.startsWith("[")) continue;
        bucket.records.push({
          c: name,
          w: player.won ? 1 : 0,
          e: player.rating || 0,
        });
      }
    }
  }

  const totalMatches = Array.from(byDate.values()).reduce((s, v) => s + v.matchCount, 0);
  const totalRecords = Array.from(byDate.values()).reduce((s, v) => s + v.records.length, 0);
  console.log(`  [${mode}] ${totalMatches} unique matches, ${totalRecords} records across ${byDate.size} days`);
  return byDate;
}

// ── Cleanup ────────────────────────────────────────────────────────────────

function cleanupOldFiles() {
  if (!existsSync(DAILY_DIR)) return;
  const files = readdirSync(DAILY_DIR).filter((f) => f.endsWith(".json")).sort();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - MAX_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let removed = 0;
  for (const file of files) {
    const date = file.replace(".json", "");
    if (date < cutoffStr) {
      unlinkSync(resolve(DAILY_DIR, file));
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`Cleaned up ${removed} files older than ${MAX_DAYS} days`);
  }
}

// ── Merge with existing daily file ─────────────────────────────────────────

function loadExistingDaily(date: string): DailyFile | null {
  const path = resolve(DAILY_DIR, `${date}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as DailyFile;
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== AoE2Meta daily stats fetch ===`);
  console.log(`Output dir: ${DAILY_DIR}`);

  // Cutoff: 31 days ago (to fill the entire window on first run)
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - MAX_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10) + "T00:00:00.000Z";
  console.log(`Cutoff: ${cutoffDate}`);

  // Collect data per date per mode
  const allDates = new Map<string, DailyFile>();

  for (const mode of MODES_TO_FETCH) {
    console.log(`\nProcessing: ${mode}`);
    try {
      const byDate = await fetchModeDataByDate(mode, cutoffDate);

      for (const [date, data] of byDate) {
        if (!allDates.has(date)) {
          // Load existing file for this date if present
          const existing = loadExistingDaily(date);
          allDates.set(date, existing ?? {
            date,
            fetchedAt: new Date().toISOString(),
            playerCount: SAMPLE_PAGES.length * 50,
            modes: {},
          });
        }
        const file = allDates.get(date)!;

        if (file.modes[mode]) {
          // Merge with existing
          const prev = file.modes[mode];
          // Deduplicate by building a set of existing record hashes
          const existingSet = new Set(
            prev.records.map((r) => `${r.c}|${r.w}|${r.e}`)
          );
          const newRecords = data.records.filter(
            (r) => !existingSet.has(`${r.c}|${r.w}|${r.e}`)
          );
          prev.matchCount += data.matchCount;
          prev.records.push(...newRecords);
        } else {
          file.modes[mode] = data;
        }
      }
    } catch (err) {
      console.error(`  [${mode}] Error:`, err);
    }
  }

  // Write all date files
  console.log(`\n=== Writing ${allDates.size} daily files ===`);
  let totalRecords = 0;
  const sortedDates = [...allDates.keys()].sort();

  for (const date of sortedDates) {
    const file = allDates.get(date)!;
    file.fetchedAt = new Date().toISOString();
    const outPath = resolve(DAILY_DIR, `${date}.json`);
    writeFileSync(outPath, JSON.stringify(file) + "\n", "utf-8");

    const records = Object.values(file.modes).reduce((s, m) => s + m.records.length, 0);
    totalRecords += records;

    const modes = Object.entries(file.modes)
      .map(([m, d]) => `${m}: ${d.matchCount} matches`)
      .join(", ");
    console.log(`  ${date}: ${records} records (${modes})`);
  }

  const sizeMB = sortedDates.reduce((s, d) => {
    const f = allDates.get(d)!;
    return s + Buffer.byteLength(JSON.stringify(f));
  }, 0) / 1024 / 1024;

  console.log(`\n=== Summary ===`);
  console.log(`Days with data: ${allDates.size}`);
  console.log(`Total records: ${totalRecords}`);
  console.log(`Total size: ${sizeMB.toFixed(2)} MB`);

  // Cleanup old files
  cleanupOldFiles();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
