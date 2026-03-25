// scripts/backfill-maps.mts
// One-time (and periodic) map stats backfill.
// Fetches last 200 matches per player across spread ELO pages → writes to
// src/data/map-stats.json  (accumulated, never pruned)
//
// New format: modes[mode][mapSlug][eloRange][civName] = { wins, games }
// ELO ranges: "all" | "low" (<800) | "med_low" (800-1099) |
//             "medium" (1100-1399) | "med_high" (1400-1799) | "high" (1800+)
//
// Run with: npm run maps:backfill

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const MS_API   = "https://api.ageofempires.com/api/v2/ageii";
const COMP_API = "https://data.aoe2companion.com/api";

const OUT_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/data/map-stats.json"
);

const MODES = [
  { id: "rm-1v1",  lb: "rm_1v1",  ms: { versus:"players", matchType:"ranked",   teamSize:"1v1" } },
  { id: "rm-team", lb: "rm_team",  ms: { versus:"team",    matchType:"ranked",   teamSize:"2v2" } },
  { id: "ew-1v1",  lb: "ew_1v1",  ms: { versus:"players", matchType:"unranked", teamSize:"1v1" } },
  { id: "ew-team", lb: "ew_team",  ms: { versus:"team",    matchType:"unranked", teamSize:"2v2" } },
] as const;

const SAMPLE_PAGES = [1,2,3,4,5,6,7,8,10,12,15,18,21,25,30,40,50,70,100,150,200,300,400,500,600,700,800,900];
const MATCHES_PER_PLAYER = 200;
const BATCH_SIZE = 10;
const BATCH_DELAY = 250;

// ELO ranges for bucketing
const ELO_RANGES = [
  { key: "low",      min: 0,    max: 799  },
  { key: "med_low",  min: 800,  max: 1099 },
  { key: "medium",   min: 1100, max: 1399 },
  { key: "med_high", min: 1400, max: 1799 },
  { key: "high",     min: 1800, max: 99999},
] as const;

type EloKey = "all" | "low" | "med_low" | "medium" | "med_high" | "high";

function getEloKey(rating: number): Exclude<EloKey, "all"> | null {
  if (!rating || rating <= 0) return null; // unknown ELO — only count in "all"
  for (const r of ELO_RANGES) {
    if (rating >= r.min && rating <= r.max) return r.key;
  }
  return null;
}

interface MapCivRecord { wins: number; games: number }
interface MapStatsFile {
  updatedAt: string;
  totalMatches: number;
  // modes[mode][mapSlug][eloRange][civName] = { wins, games }
  modes: Record<string, Record<string, Record<EloKey, Record<string, MapCivRecord>>>>;
}

async function fetchLbPage(params: Record<string, string>, page: number): Promise<number[]> {
  try {
    const r = await fetch(`${MS_API}/Leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ region: 7, ...params, searchPlayer: "", page, count: 50 }),
    });
    if (!r.ok) return [];
    const d = await r.json() as { items?: { rlUserId: number }[] };
    return (d.items ?? []).map(p => p.rlUserId).filter(Boolean);
  } catch { return []; }
}

interface CompanionPlayer { civName?: string; civ?: string; won: boolean; rating?: number }
interface CompanionMatch {
  leaderboardId: string;
  mapName?: string;
  started: string;
  teams: { players: CompanionPlayer[] }[];
}

async function fetchMatches(pid: number): Promise<CompanionMatch[]> {
  try {
    const r = await fetch(
      `${COMP_API}/matches?profile_ids=${pid}&count=${MATCHES_PER_PLAYER}`,
      { headers: { "User-Agent": "AoE2Meta/1.0" } }
    );
    if (!r.ok) return [];
    const d = await r.json() as { matches?: CompanionMatch[] };
    return d.matches ?? [];
  } catch { return []; }
}

function cap(s: string): string {
  return s.split(/[\s_-]/).map(w => w ? w[0].toUpperCase() + w.slice(1) : "").join(" ").trim();
}

function addRecord(
  modeData: Record<string, Record<EloKey, Record<string, MapCivRecord>>>,
  mapSlug: string,
  eloKey: EloKey,
  civName: string,
  won: boolean
) {
  if (!modeData[mapSlug]) modeData[mapSlug] = {} as Record<EloKey, Record<string, MapCivRecord>>;
  if (!modeData[mapSlug][eloKey]) modeData[mapSlug][eloKey] = {};
  const rec = modeData[mapSlug][eloKey][civName] ?? { wins: 0, games: 0 };
  rec.games++;
  if (won) rec.wins++;
  modeData[mapSlug][eloKey][civName] = rec;
}

async function main() {
  console.log("=== AoE2Meta map stats backfill (with ELO buckets) ===");

  // Always start fresh to rebuild with new format
  const data: MapStatsFile = { updatedAt: "", totalMatches: 0, modes: {} };
  console.log("Rebuilding map-stats.json with ELO buckets...");

  let grandTotal = 0;

  for (const mode of MODES) {
    console.log(`\n[${mode.id}] Fetching leaderboard...`);

    const pages = await Promise.allSettled(
      SAMPLE_PAGES.map(p => fetchLbPage(mode.ms as Record<string, string>, p))
    );
    const ids = [...new Set(
      pages.flatMap(p => p.status === "fulfilled" ? p.value : [])
    )];
    console.log(`  ${ids.length} unique players`);
    if (ids.length === 0) continue;

    const allMatches: CompanionMatch[] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(id => fetchMatches(id)));
      for (const r of results) {
        if (r.status === "fulfilled") allMatches.push(...r.value);
      }
      if (i + BATCH_SIZE < ids.length)
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      const done = Math.min(i + BATCH_SIZE, ids.length);
      if (done % 200 === 0 || done === ids.length)
        console.log(`  ${done}/${ids.length} players, ${allMatches.length} raw entries`);
    }

    const seen = new Set<string>();
    let modeMatches = 0;

    if (!data.modes[mode.id]) data.modes[mode.id] = {};
    const modeData = data.modes[mode.id];

    for (const m of allMatches) {
      if (m.leaderboardId !== mode.lb) continue;
      const key = `${m.started}|${m.mapName ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const mapSlug = m.mapName?.toLowerCase().replace(/\s+/g, "_") ?? "";
      if (!mapSlug) continue;
      modeMatches++;

      for (const team of m.teams ?? []) {
        for (const player of team.players ?? []) {
          const civName = cap(player.civName || player.civ || "");
          if (!civName || civName.startsWith("[")) continue;
          const won = player.won;
          const rating = player.rating ?? 0;

          // Always add to "all"
          addRecord(modeData, mapSlug, "all", civName, won);

          // Add to specific ELO bucket if known
          const eloKey = getEloKey(rating);
          if (eloKey) addRecord(modeData, mapSlug, eloKey, civName, won);
        }
      }
    }

    grandTotal += modeMatches;
    const mapCount = Object.keys(modeData).length;
    console.log(`  [${mode.id}] ${modeMatches.toLocaleString()} unique matches → ${mapCount} maps`);

    const topMaps = Object.entries(modeData)
      .map(([slug, elos]) => ({
        slug,
        total: Object.values(elos["all"] ?? {}).reduce((s, v) => s + v.games, 0)
      }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
    for (const { slug, total } of topMaps)
      console.log(`    ${cap(slug)}: ${total.toLocaleString()} civ-records`);
  }

  data.updatedAt = new Date().toISOString();
  data.totalMatches = grandTotal;

  const dir = resolve(OUT_FILE, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(data) + "\n", "utf-8");

  const fileSizeKB = Math.round(Buffer.byteLength(JSON.stringify(data)) / 1024);
  console.log(`\n=== Done ===`);
  console.log(`Matches: ${grandTotal.toLocaleString()}`);
  console.log(`File size: ${fileSizeKB} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
