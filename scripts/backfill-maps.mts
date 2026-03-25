// scripts/backfill-maps.mts
// One-time (and periodic) map stats backfill.
// Fetches last 200 matches per player across spread ELO pages → writes to
// src/data/map-stats.json  (accumulated, never pruned)
//
// Run with: npm run maps:backfill

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const MS_API    = "https://api.ageofempires.com/api/v2/ageii";
const COMP_API  = "https://data.aoe2companion.com/api";

const OUT_FILE  = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/data/map-stats.json"
);

const MODES = [
  { id: "rm-1v1",  lb: "rm_1v1",  ms: { versus:"players", matchType:"ranked",   teamSize:"1v1" } },
  { id: "rm-team", lb: "rm_team",  ms: { versus:"team",    matchType:"ranked",   teamSize:"2v2" } },
  { id: "ew-1v1",  lb: "ew_1v1",  ms: { versus:"players", matchType:"unranked", teamSize:"1v1" } },
  { id: "ew-team", lb: "ew_team",  ms: { versus:"team",    matchType:"unranked", teamSize:"2v2" } },
] as const;

// More pages for better coverage — 30 pages × 50 = 1500 players per mode
const SAMPLE_PAGES = [1,2,3,4,5,6,7,8,10,12,15,18,21,25,30,40,50,70,100,150,200,300,400,500,600,700,800,900];
const MATCHES_PER_PLAYER = 200; // go back ~2-3 months
const BATCH_SIZE = 10;
const BATCH_DELAY = 250;

interface MapCivRecord { wins: number; games: number }
interface MapStatsFile {
  updatedAt: string;
  totalMatches: number;
  modes: Record<string, Record<string, Record<string, MapCivRecord>>>;
  // modes[mode][mapSlug][civName] = { wins, games }
}

async function fetchLbPage(params: Record<string,string>, page: number): Promise<number[]> {
  try {
    const r = await fetch(`${MS_API}/Leaderboard`, {
      method:"POST",
      headers:{"Content-Type":"application/json",Accept:"application/json"},
      body: JSON.stringify({ region:7, ...params, searchPlayer:"", page, count:50 }),
    });
    if (!r.ok) return [];
    const d = await r.json() as { items?:{rlUserId:number}[] };
    return (d.items??[]).map(p=>p.rlUserId).filter(Boolean);
  } catch { return []; }
}

async function fetchMatches(pid: number): Promise<{leaderboardId:string;mapName?:string;started:string;teams:{players:{civName?:string;civ?:string;won:boolean}[]}[]}[]> {
  try {
    const r = await fetch(`${COMP_API}/matches?profile_ids=${pid}&count=${MATCHES_PER_PLAYER}`,
      {headers:{"User-Agent":"AoE2Meta/1.0"}});
    if (!r.ok) return [];
    const d = await r.json() as {matches?:unknown[]};
    return (d.matches??[]) as never;
  } catch { return []; }
}

function cap(s:string):string {
  return s.split(/[\s_-]/).map(w=>w?w[0].toUpperCase()+w.slice(1):"").join(" ").trim();
}

async function main() {
  console.log("=== AoE2Meta map stats backfill ===");

  // Load existing data
  let data: MapStatsFile;
  if (existsSync(OUT_FILE)) {
    data = JSON.parse(readFileSync(OUT_FILE,"utf-8")) as MapStatsFile;
    console.log(`Loaded existing: ${data.totalMatches.toLocaleString()} matches`);
  } else {
    data = { updatedAt:"", totalMatches:0, modes:{} };
    console.log("Starting fresh");
  }

  let grandTotal = 0;

  for (const mode of MODES) {
    console.log(`\n[${mode.id}] Fetching leaderboard...`);

    const pages = await Promise.allSettled(
      SAMPLE_PAGES.map(p => fetchLbPage(mode.ms as Record<string,string>, p))
    );
    const ids = [...new Set(
      pages.flatMap(p => p.status==="fulfilled" ? p.value : [])
    )];
    console.log(`  ${ids.length} unique players`);
    if (ids.length === 0) continue;

    const allMatches: typeof import("node:stream") extends never ? never : Awaited<ReturnType<typeof fetchMatches>> = [];
    for (let i=0; i<ids.length; i+=BATCH_SIZE) {
      const batch = ids.slice(i, i+BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(id => fetchMatches(id)));
      for (const r of results) {
        if (r.status==="fulfilled") (allMatches as unknown[]).push(...r.value);
      }
      if (i+BATCH_SIZE < ids.length)
        await new Promise(r=>setTimeout(r, BATCH_DELAY));
      const done = Math.min(i+BATCH_SIZE, ids.length);
      if (done % 200===0 || done===ids.length)
        console.log(`  ${done}/${ids.length} players, ${(allMatches as unknown[]).length} raw entries`);
    }

    // Deduplicate by matchId and filter to this mode
    const seen = new Set<string>();
    let modeMatches = 0;

    if (!data.modes[mode.id]) data.modes[mode.id] = {};
    const modeData = data.modes[mode.id];

    for (const m of allMatches as Awaited<ReturnType<typeof fetchMatches>>) {
      if (m.leaderboardId !== mode.lb) continue;
      // We don't have matchId here but we can use started+mapName as proxy
      const key = `${m.started}|${m.mapName??''}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const mapSlug = m.mapName?.toLowerCase().replace(/\s+/g,"_") ?? "";
      if (!mapSlug) continue;

      if (!modeData[mapSlug]) modeData[mapSlug] = {};
      modeMatches++;

      for (const team of m.teams??[]) {
        for (const player of team.players??[]) {
          const civName = cap(player.civName||player.civ||"");
          if (!civName || civName.startsWith("[")) continue;
          const rec = modeData[mapSlug][civName] ?? {wins:0, games:0};
          rec.games++;
          if (player.won) rec.wins++;
          modeData[mapSlug][civName] = rec;
        }
      }
    }

    grandTotal += modeMatches;
    const mapCount = Object.keys(modeData).length;
    console.log(`  [${mode.id}] ${modeMatches.toLocaleString()} unique matches → ${mapCount} maps`);

    // Show top maps
    const topMaps = Object.entries(modeData)
      .map(([slug, civs]) => ({slug, total: Object.values(civs).reduce((s,v)=>s+v.games,0)}))
      .sort((a,b)=>b.total-a.total).slice(0,5);
    for (const {slug, total} of topMaps)
      console.log(`    ${cap(slug)}: ${total.toLocaleString()} civ-records`);
  }

  data.updatedAt = new Date().toISOString();
  data.totalMatches += grandTotal;

  const dir = resolve(OUT_FILE, "..");
  if (!existsSync(dir)) mkdirSync(dir, {recursive:true});
  writeFileSync(OUT_FILE, JSON.stringify(data)+"\n","utf-8");

  const fileSizeKB = Math.round(Buffer.byteLength(JSON.stringify(data))/1024);
  console.log(`\n=== Done ===`);
  console.log(`New matches: ${grandTotal.toLocaleString()}`);
  console.log(`Cumulative: ${data.totalMatches.toLocaleString()}`);
  console.log(`File size: ${fileSizeKB} KB`);
  console.log(`Written to: ${OUT_FILE}`);
}

main().catch(e=>{console.error(e);process.exit(1);});
