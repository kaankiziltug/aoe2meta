#!/usr/bin/env python3
"""
fetch-strategy-stats.py
Run with: python3 scripts/fetch-strategy-stats.py [--continuous]

Architecture:
  1. Fetch top 2500 players (1800+ ELO) from MS leaderboard
  2. Fetch last 30 matches per player (last LAST_N_DAYS days) via AoE2Companion
  3. Download + parse each replay (mgz.fast) — FULL GAME, no time limit
  4. Append rich per-player records to  data/raw-replays/YYYY-MM-DD.jsonl
  5. Rebuild src/data/strategy-stats.json from last 30 days via DuckDB

Raw JSONL record per player per match (full game):
  {
    matchId, date, mapName, mapSlug, mode,
    profileId, civName, civId, opening, won, elo,
    feudalMs, castleMs, imperialMs,

    # Villagers queued per age
    darkVillagers, feudalVillagers, castleVillagers, imperialVillagers,

    # All non-villager units queued per age  {unitId(str): count}
    darkUnits, feudalUnits, castleUnits, imperialUnits,

    # All buildings placed per age  {buildingId(str): count}
    darkBuildings, feudalBuildings, castleBuildings, imperialBuildings,

    # All techs researched per age  {techId(str): count}
    darkTechs, feudalTechs, castleTechs, imperialTechs,
  }
"""

import fcntl, io, json, logging, time, zipfile, urllib.request, urllib.error
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
OUT_FILE  = REPO_ROOT / "src/data/strategy-stats.json"
RAW_DIR   = REPO_ROOT / "data/raw-replays"
RAW_DIR.mkdir(parents=True, exist_ok=True)

# ── API endpoints ─────────────────────────────────────────────────────────────
MS_API        = "https://api.ageofempires.com/api/v2/ageii"
COMPANION_API = "https://data.aoe2companion.com/api"
REPLAY_API    = "https://aoe.ms/replay"

# ── Pipeline config ───────────────────────────────────────────────────────────
PAGES_PER_SHARD    = 50         # 50 pages × 50 players = 2500 players per shard
MATCHES_PER_PLAYER = 30
REPLAYS_PER_RUN    = 600        # per shard per iteration
BATCH_DELAY_S      = 0.0        # rate control now handled by global _acquire_replay_slot()
LAST_N_DAYS        = 30
CONTINUOUS         = True
LOOP_DELAY_S       = 5

# ── AoE2 constants ────────────────────────────────────────────────────────────
FEUDAL_TECH   = 101
CASTLE_TECH   = 102
IMPERIAL_TECH = 103
VILLAGER_IDS  = {83, 293}   # Male villager, Female villager

_CIV_NAMES: dict[int, str] = {}

def _load_civ_names() -> None:
    global _CIV_NAMES
    try:
        import aocref
        base = Path(aocref.__file__).parent / "data/datasets"
        data = json.loads((base / "100.json").read_text())
        for k, v in data.get("civilizations", {}).items():
            if isinstance(v, str):
                _CIV_NAMES[int(k)] = v
    except Exception as e:
        log.warning("Could not load civ names from aocref: %s", e)

_load_civ_names()

def civ_name(civ_id: int) -> str:
    return _CIV_NAMES.get(civ_id, f"Civ{civ_id}")

# ── ELO bucketing ─────────────────────────────────────────────────────────────
ELO_BUCKETS = [
    ("all",       0,    9999),
    ("1000-1400", 1000, 1399),
    ("1400-1800", 1400, 1799),
    ("1800+",     1800, 9999),
    ("2000+",     2000, 9999),
]

def elo_labels(rating: int) -> list[str]:
    return [label for label, lo, hi in ELO_BUCKETS if lo <= rating <= hi]

# ── Opening classifier ────────────────────────────────────────────────────────
MILITIA_ID    = 74;  MAA_ID        = 75
ARCHER_ID     = 4;   CROSSBOW_ID   = 24
SKIRMISHER_ID = 7;   SPEARMAN_ID   = 93;  PIKEMAN_ID = 358
SCOUT_ID      = 448; LIGHT_CAV_ID  = 37
BARRACKS_IDS  = {12, 20, 132}
ARCHERY_IDS   = {10, 14, 87}
STABLE_IDS    = {86, 101, 153}

def classify_opening(
    feudal_ms: int, castle_ms: int,
    dark_units: Counter, feudal_units: Counter, feudal_buildings: Counter,
) -> str:
    dark_militia = dark_units[MILITIA_ID]
    f_archers = feudal_units[ARCHER_ID] + feudal_units[CROSSBOW_ID]
    f_maa     = feudal_units[MILITIA_ID] + feudal_units[MAA_ID]
    f_scouts  = feudal_units[SCOUT_ID]   + feudal_units[LIGHT_CAV_ID]
    f_skirms  = feudal_units[SKIRMISHER_ID]
    f_spears  = feudal_units[SPEARMAN_ID] + feudal_units[PIKEMAN_ID]

    has_archery = any(feudal_buildings.get(b, 0) > 0 for b in ARCHERY_IDS)
    has_stable  = any(feudal_buildings.get(b, 0) > 0 for b in STABLE_IDS)

    is_drush = dark_militia >= 3
    ftc      = (castle_ms - feudal_ms) if feudal_ms > 0 and castle_ms > 0 else 999_999_999
    is_fc    = ftc < 9 * 60_000 and f_maa + f_archers + f_scouts < 4
    is_scout = f_scouts >= 3 and has_stable

    if is_drush and is_fc:              return "Drush FC"
    if is_drush and f_archers >= 3:     return "Drush Archers"
    if is_drush and f_maa >= 2:         return "Drush M@A"
    if is_drush:                        return "Drush"
    if f_maa >= 2 and f_archers >= 3:   return "M@A Archers"
    if f_maa >= 4:                      return "M@A Rush"
    if f_archers >= 4:                  return "Archer Rush"
    if is_scout:                        return "Scout Rush"
    if f_skirms >= 2 and f_spears >= 2: return "Pike Skirm"
    if is_fc:                           return "Fast Castle"
    if f_archers >= 2 and has_archery:  return "Archer Rush"
    if f_scouts >= 2 and has_stable:    return "Scout Rush"
    return "Other"

# ── Full-game replay parser ───────────────────────────────────────────────────
def parse_replay(replay_bytes: bytes) -> list[dict] | None:
    """
    Parse entire replay (no time limit).
    Returns per-player full-game data across all 4 ages.
    Tracks ALL unit, building and tech IDs — no whitelist filtering.
    """
    try:
        from mgz.fast import operation, meta, Action, Operation
        from mgz.fast.header import parse as parse_header

        buf  = io.BytesIO(replay_bytes)
        hdr  = parse_header(buf)
        body = io.BytesIO(replay_bytes[buf.tell():])

        # Build player state
        players: dict[int, dict] = {}
        for p in hdr.get("de", {}).get("players", []):
            num = p.get("number", 0)
            if num < 1:
                continue
            players[num] = {
                "profile_id":  p.get("profile_id", 0),
                "civ_id":      p.get("civilization_id", 0),
                "player_number": num,
                # Age transition times
                "feudal_ms":   0,
                "castle_ms":   0,
                "imperial_ms": 0,
                # Villager counts per age
                "dark_villagers":     0,
                "feudal_villagers":   0,
                "castle_villagers":   0,
                "imperial_villagers": 0,
                # Unit counters per age (all IDs, excl. villagers)
                "dark_units":     Counter(),
                "feudal_units":   Counter(),
                "castle_units":   Counter(),
                "imperial_units": Counter(),
                # Building counters per age
                "dark_buildings":     Counter(),
                "feudal_buildings":   Counter(),
                "castle_buildings":   Counter(),
                "imperial_buildings": Counter(),
                # Tech counters per age
                "dark_techs":     Counter(),
                "feudal_techs":   Counter(),
                "castle_techs":   Counter(),
                "imperial_techs": Counter(),
                # Current age
                "age": "dark",
            }

        meta(body)
        game_ms = 0

        while True:
            try:
                op_type, payload = operation(body)
            except EOFError:
                break

            if op_type == Operation.SYNC:
                game_ms += payload[0]
                continue

            if op_type != Operation.ACTION:
                continue

            action_type, ap = payload
            pid = ap.get("player_id", 0)
            p   = players.get(pid)
            if p is None:
                continue

            age = p["age"]

            # ── Age transitions ──────────────────────────────────────────────
            if action_type == Action.RESEARCH:
                tech_id = ap.get("technology_id", 0)
                if tech_id == FEUDAL_TECH and p["feudal_ms"] == 0:
                    p["feudal_ms"] = game_ms
                    p["age"] = "feudal"
                    age = "feudal"
                elif tech_id == CASTLE_TECH and p["castle_ms"] == 0:
                    p["castle_ms"] = game_ms
                    p["age"] = "castle"
                    age = "castle"
                elif tech_id == IMPERIAL_TECH and p["imperial_ms"] == 0:
                    p["imperial_ms"] = game_ms
                    p["age"] = "imperial"
                    age = "imperial"
                # Record all tech researches (including age-ups)
                p[f"{age}_techs"][tech_id] += 1
                continue

            # ── Unit production ──────────────────────────────────────────────
            if action_type == Action.DE_QUEUE:
                unit_id = ap.get("unit_id", 0)
                amount  = ap.get("amount", 1)
                if unit_id in VILLAGER_IDS:
                    p[f"{age}_villagers"] += amount
                else:
                    p[f"{age}_units"][unit_id] += amount
                continue

            # ── Buildings ────────────────────────────────────────────────────
            if action_type == Action.BUILD:
                bldg_id = ap.get("building_id", 0)
                p[f"{age}_buildings"][bldg_id] += 1
                continue

    except Exception as e:
        log.debug("Replay parse error: %s", e)
        return None

    if not players:
        return None

    result = []
    for p in players.values():
        opening = classify_opening(
            feudal_ms=p["feudal_ms"],
            castle_ms=p["castle_ms"],
            dark_units=p["dark_units"],
            feudal_units=p["feudal_units"],
            feudal_buildings=p["feudal_buildings"],
        )
        result.append({
            "profile_id":    p["profile_id"],
            "civ_id":        p["civ_id"],
            "player_number": p["player_number"],
            "feudal_ms":     p["feudal_ms"],
            "castle_ms":     p["castle_ms"],
            "imperial_ms":   p["imperial_ms"],
            "opening":       opening,
            # Villagers
            "dark_villagers":     p["dark_villagers"],
            "feudal_villagers":   p["feudal_villagers"],
            "castle_villagers":   p["castle_villagers"],
            "imperial_villagers": p["imperial_villagers"],
            # Units (Counter → plain dict with str keys for JSON)
            "dark_units":     {str(k): v for k, v in p["dark_units"].items()},
            "feudal_units":   {str(k): v for k, v in p["feudal_units"].items()},
            "castle_units":   {str(k): v for k, v in p["castle_units"].items()},
            "imperial_units": {str(k): v for k, v in p["imperial_units"].items()},
            # Buildings
            "dark_buildings":     {str(k): v for k, v in p["dark_buildings"].items()},
            "feudal_buildings":   {str(k): v for k, v in p["feudal_buildings"].items()},
            "castle_buildings":   {str(k): v for k, v in p["castle_buildings"].items()},
            "imperial_buildings": {str(k): v for k, v in p["imperial_buildings"].items()},
            # Techs
            "dark_techs":     {str(k): v for k, v in p["dark_techs"].items()},
            "feudal_techs":   {str(k): v for k, v in p["feudal_techs"].items()},
            "castle_techs":   {str(k): v for k, v in p["castle_techs"].items()},
            "imperial_techs": {str(k): v for k, v in p["imperial_techs"].items()},
        })
    return result

# ── HTTP helpers ──────────────────────────────────────────────────────────────
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}

def http_get(url: str, timeout: int = 15, retries: int = 3) -> bytes | None:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                # Rate limited — fail fast, rely on _acquire_replay_slot() to prevent this.
                # A short wait lets the token bucket recover without wasting minutes.
                log.debug("429 rate-limit on %s", url)
                time.sleep(15)
                return None          # don't retry — move to next candidate
            elif e.code in (404, 410):
                return None
            else:
                log.debug("HTTP %d: %s", e.code, url)
                return None
        except Exception as e:
            log.debug("HTTP error %s: %s", url, e)
            if attempt < retries - 1:
                time.sleep(3)
    return None

def fetch_leaderboard_players(page: int) -> list[dict]:
    body = json.dumps({
        "region": 7, "versus": "players", "matchType": "ranked",
        "teamSize": "1v1", "searchPlayer": "", "page": page, "count": 50,
        "sortColumn": "rank", "sortDirection": "ASC",
    }).encode()
    try:
        req = urllib.request.Request(
            f"{MS_API}/Leaderboard", data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()).get("items", [])
    except Exception as e:
        log.debug("Leaderboard page %d error: %s", page, e)
        return []

def fetch_player_matches(profile_id: int, days: int = LAST_N_DAYS) -> list[dict]:
    raw = http_get(f"{COMPANION_API}/matches?profile_ids={profile_id}&count={MATCHES_PER_PLAYER}")
    if not raw:
        return []
    try:
        cutoff  = datetime.now(timezone.utc) - timedelta(days=days)
        filtered = []
        for m in json.loads(raw).get("matches", []):
            if "rm_1v1" not in str(m.get("leaderboard") or m.get("leaderboardId", "")):
                continue
            started  = m.get("started", "")
            finished = m.get("finished", "")
            if started and finished:
                try:
                    s = datetime.fromisoformat(started.replace("Z", "+00:00"))
                    f = datetime.fromisoformat(finished.replace("Z", "+00:00"))
                    if s < cutoff:
                        continue
                    if (f - s).total_seconds() < 8 * 60:
                        continue
                    m["_started_dt"] = s.strftime("%Y-%m-%d")
                except Exception:
                    pass
            filtered.append(m)
        return filtered
    except Exception:
        return []

# ── Global aoe.ms rate limiter (shared across all worker processes) ────────────
# Safe rate: 1 request every MIN_REPLAY_INTERVAL seconds across ALL workers.
# Uses an exclusive-lock + timestamp file so workers coordinate automatically.
MIN_REPLAY_INTERVAL = 5.0   # seconds between requests to aoe.ms (all workers combined)
_RATE_LOCK_FILE = RAW_DIR / ".aoe_rate_lock"

def _acquire_replay_slot() -> None:
    """Block until we're allowed to make the next aoe.ms request."""
    _RATE_LOCK_FILE.touch(exist_ok=True)
    while True:
        with open(_RATE_LOCK_FILE, "r+") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            content = f.read().strip()
            last_ts = float(content) if content else 0.0
            now = time.time()
            wait = MIN_REPLAY_INTERVAL - (now - last_ts)
            if wait <= 0:
                f.seek(0); f.write(str(now)); f.truncate()
                fcntl.flock(f, fcntl.LOCK_UN)
                return
            fcntl.flock(f, fcntl.LOCK_UN)
        time.sleep(max(wait, 0.05))

def download_replay(match_id: int, profile_id: int) -> bytes | None:
    _acquire_replay_slot()
    raw = http_get(f"{REPLAY_API}/?gameId={match_id}&profileId={profile_id}", timeout=30, retries=4)
    if not raw:
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            names = zf.namelist()
            rec   = next((n for n in names if n.endswith(".aoe2record")), names[0] if names else None)
            return zf.read(rec) if rec else None
    except Exception as e:
        log.debug("Unzip error match %d: %s", match_id, e)
        return None

# ── Raw JSONL storage ─────────────────────────────────────────────────────────
def append_raw_records(records: list[dict]) -> None:
    by_date: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_date[r["date"]].append(r)
    for date_str, recs in by_date.items():
        path = RAW_DIR / f"{date_str}.jsonl"
        with open(path, "a", encoding="utf-8") as f:
            for r in recs:
                f.write(json.dumps(r, separators=(",", ":")) + "\n")

# ── Processed IDs (file-lock safe for parallel workers) ───────────────────────
PROCESSED_IDS_FILE = RAW_DIR / "processed_ids.json"

def load_processed_ids() -> set[int]:
    """Shared-lock read — safe to call from multiple workers simultaneously."""
    PROCESSED_IDS_FILE.touch(exist_ok=True)
    try:
        with open(PROCESSED_IDS_FILE, "r") as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            content = f.read()
            fcntl.flock(f, fcntl.LOCK_UN)
        return set(json.loads(content)) if content.strip() else set()
    except Exception:
        return set()

def save_processed_ids(new_ids: set[int]) -> None:
    """Exclusive-lock read-merge-write — multiple workers can call concurrently."""
    PROCESSED_IDS_FILE.touch(exist_ok=True)
    with open(PROCESSED_IDS_FILE, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            content = f.read()
            existing = set(json.loads(content)) if content.strip() else set()
        except Exception:
            existing = set()
        merged = existing | new_ids
        f.seek(0)
        f.write(json.dumps(list(merged)))
        f.truncate()
        fcntl.flock(f, fcntl.LOCK_UN)

# ── DuckDB stats rebuild ──────────────────────────────────────────────────────
def rebuild_stats_from_raw() -> dict:
    """
    Read last LAST_N_DAYS of JSONL via DuckDB, rebuild strategy-stats.json.
    Each record belongs to multiple ELO buckets — we UNNEST them in SQL.
    """
    import duckdb

    jsonl_files = sorted(RAW_DIR.glob("*.jsonl"))
    if not jsonl_files:
        log.info("No JSONL files yet, skipping rebuild.")
        return {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "windowDays": LAST_N_DAYS, "totalRecords": 0}

    cutoff = (datetime.now(timezone.utc) - timedelta(days=LAST_N_DAYS)).strftime("%Y-%m-%d")

    # Build glob pattern for DuckDB
    pattern = str(RAW_DIR / "*.jsonl")

    try:
        con = duckdb.connect()
        rows = con.execute(f"""
            WITH base AS (
                SELECT
                    mode, mapSlug, civName, opening, won, elo,
                    UNNEST(
                        ['all']
                        || CASE WHEN elo >= 1000 AND elo <= 1399 THEN ['1000-1400'] ELSE [] END
                        || CASE WHEN elo >= 1400 AND elo <= 1799 THEN ['1400-1800'] ELSE [] END
                        || CASE WHEN elo >= 1800               THEN ['1800+']     ELSE [] END
                        || CASE WHEN elo >= 2000               THEN ['2000+']     ELSE [] END
                    ) AS eloLabel
                FROM read_ndjson({repr(pattern)}, ignore_errors=true)
                WHERE date >= {repr(cutoff)}
            )
            SELECT
                mode, mapSlug, eloLabel, civName, opening,
                COUNT(*)              AS games,
                SUM(won::INTEGER)     AS wins
            FROM base
            GROUP BY ALL
            ORDER BY mode, mapSlug, eloLabel, civName, games DESC
        """).fetchall()
        total = con.execute(
            f"SELECT COUNT(*) FROM read_ndjson({repr(pattern)}, ignore_errors=true) WHERE date >= {repr(cutoff)}"
        ).fetchone()[0]
        con.close()
    except Exception as e:
        log.error("DuckDB rebuild failed: %s", e)
        return {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "windowDays": LAST_N_DAYS, "totalRecords": 0}

    log.info("DuckDB: %d rows → %d total records (last %d days)", len(rows), total, LAST_N_DAYS)

    # Assemble nested dict: stats[mode][mapSlug][eloLabel][civName][opening]
    stats: dict = {}
    for mode, map_slug, elo_label, civ, opening, games, wins in rows:
        (stats
            .setdefault(mode, {})
            .setdefault(map_slug, {})
            .setdefault(elo_label, {})
            .setdefault(civ, {})
            [opening]) = {"games": games, "wins": wins}

    return {
        "updated":      datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "windowDays":   LAST_N_DAYS,
        "totalRecords": total,
        **stats,
    }

def save_stats(stats: dict) -> None:
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(stats, separators=(",", ":")))
    log.info("Saved stats → %s  (records=%s)", OUT_FILE, stats.get("totalRecords", "?"))

# ── Main pipeline loop ────────────────────────────────────────────────────────
def run_once(processed_ids: set[int], pages: list[int]) -> tuple[int, int]:
    # 1. Leaderboard
    log.info("Fetching %d leaderboard pages (p%d–p%d)…", len(pages), pages[0], pages[-1])
    profile_elo: dict[int, int] = {}
    for page in pages:
        for item in fetch_leaderboard_players(page):
            pid = item.get("rlUserId")
            elo = item.get("elo") or 0
            if pid and elo > 0:
                profile_elo[pid] = elo
        time.sleep(0.15)
    unique_ids = list(profile_elo)
    if unique_ids:
        log.info("Players: %d  ELO: %d – %d",
                 len(unique_ids), min(profile_elo.values()), max(profile_elo.values()))

    # 2. Match candidates (last 30 days only)
    candidates: list[dict] = []
    seen: set[int] = set()
    for i, pid in enumerate(unique_ids):
        for m in fetch_player_matches(pid):
            mid = m.get("matchId")
            if mid and mid not in seen and mid not in processed_ids:
                seen.add(mid)
                m["_fetched_profile_id"] = pid
                m["_fetched_elo"] = profile_elo[pid]
                candidates.append(m)
        if (i + 1) % 100 == 0:
            log.info("  match fetch: %d / %d players | candidates: %d",
                     i + 1, len(unique_ids), len(candidates))
        time.sleep(0.08)
    log.info("New candidates (last %d days): %d", LAST_N_DAYS, len(candidates))

    # 3. Download + parse
    done = 0; new_rec = 0; dl_fail = 0; parse_fail = 0
    raw_batch: list[dict] = []
    new_processed: set[int] = set()   # IDs processed in this run (for incremental save)

    for match in candidates:
        if done >= REPLAYS_PER_RUN:
            break

        mid         = match.get("matchId")
        map_name    = match.get("mapName", "unknown") or "unknown"
        map_slug    = map_name.lower().replace(" ", "_").replace("(","").replace(")","").strip()
        match_date  = match.get("_started_dt") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        match_elo   = match.get("_fetched_elo", 0)
        fetched_pid = match.get("_fetched_profile_id", 0)

        # Build companion map: pid → (civName, won, elo)
        companion: dict[int, tuple[str, bool, int]] = {}
        first_pid: int | None = None
        for team in match.get("teams", []):
            for pl in team.get("players", []):
                pid = pl.get("profileId") or pl.get("profile_id")
                if pid is None:
                    continue
                if first_pid is None:
                    first_pid = pid
                elo = (match_elo if pid == fetched_pid
                       else profile_elo.get(pid, 0) or pl.get("rating") or 0)
                companion[pid] = (pl.get("civName") or pl.get("civ", ""), bool(pl.get("won")), elo)

        if not first_pid:
            processed_ids.add(mid); continue

        replay = download_replay(mid, first_pid)
        if not replay:
            dl_fail += 1; processed_ids.add(mid); done += 1; continue

        parsed = parse_replay(replay)
        if not parsed:
            parse_fail += 1; processed_ids.add(mid); done += 1; continue

        for pd in parsed:
            pid = pd["profile_id"]
            if pid not in companion:
                continue
            civ_n, won, elo = companion[pid]
            raw_batch.append({
                "matchId":  mid,
                "date":     match_date,
                "mapName":  map_name,
                "mapSlug":  map_slug,
                "mode":     "rm-1v1",
                "profileId": pid,
                "civName":  civ_n or civ_name(pd["civ_id"]),
                "civId":    pd["civ_id"],
                "opening":  pd["opening"],
                "won":      won,
                "elo":      elo,
                # Age times
                "feudalMs":   pd["feudal_ms"],
                "castleMs":   pd["castle_ms"],
                "imperialMs": pd["imperial_ms"],
                # Villagers
                "darkVillagers":     pd["dark_villagers"],
                "feudalVillagers":   pd["feudal_villagers"],
                "castleVillagers":   pd["castle_villagers"],
                "imperialVillagers": pd["imperial_villagers"],
                # Units
                "darkUnits":     pd["dark_units"],
                "feudalUnits":   pd["feudal_units"],
                "castleUnits":   pd["castle_units"],
                "imperialUnits": pd["imperial_units"],
                # Buildings
                "darkBuildings":     pd["dark_buildings"],
                "feudalBuildings":   pd["feudal_buildings"],
                "castleBuildings":   pd["castle_buildings"],
                "imperialBuildings": pd["imperial_buildings"],
                # Techs
                "darkTechs":     pd["dark_techs"],
                "feudalTechs":   pd["feudal_techs"],
                "castleTechs":   pd["castle_techs"],
                "imperialTechs": pd["imperial_techs"],
            })
            new_rec += 1

        processed_ids.add(mid)
        new_processed.add(mid)
        done += 1

        if done % 50 == 0:
            log.info("  replays: %d/%d | records: +%d | dl_fail: %d | parse_fail: %d",
                     done, REPLAYS_PER_RUN, new_rec, dl_fail, parse_fail)
            # Flush every 50 replays — don't lose progress if process is killed
            if raw_batch:
                append_raw_records(raw_batch)
                save_processed_ids(new_processed)   # incremental merge (multi-worker safe)
                raw_batch = []
                new_processed = set()
                log.info("  → flushed to JSONL (checkpoint)")

        time.sleep(BATCH_DELAY_S)

    if raw_batch:
        append_raw_records(raw_batch)
        save_processed_ids(new_processed)
        log.info("Appended %d records to JSONL", len(raw_batch))

    log.info("Run done — replays: %d | records: +%d | dl_fail: %d | parse_fail: %d",
             done, new_rec, dl_fail, parse_fail)
    return done, new_rec


def main() -> None:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--continuous", action="store_true", default=CONTINUOUS)
    ap.add_argument("--shard",           type=int, default=0,
                    help="Worker index (0-based)")
    ap.add_argument("--num-shards",      type=int, default=1,
                    help="Total number of parallel workers")
    ap.add_argument("--pages-per-shard", type=int, default=PAGES_PER_SHARD,
                    help="Leaderboard pages per shard (50 pages = 2500 players)")
    args = ap.parse_args()

    # Compute this shard's leaderboard page range
    start_page = args.shard * args.pages_per_shard + 1
    end_page   = start_page + args.pages_per_shard
    pages      = list(range(start_page, end_page))
    is_primary = (args.shard == 0)   # only primary shard rebuilds stats JSON

    log.info("=== AoE2Meta strategy pipeline  shard=%d/%d  pages=%d–%d ===",
             args.shard, args.num_shards, pages[0], pages[-1])
    log.info("LAST_N_DAYS=%d  REPLAYS_PER_RUN=%d  BATCH_DELAY=%.2fs  CONTINUOUS=%s",
             LAST_N_DAYS, REPLAYS_PER_RUN, BATCH_DELAY_S, args.continuous)

    total_replays = total_records = iteration = 0

    try:
        while True:
            iteration += 1
            # Reload processed IDs each iteration (other shards may have added IDs)
            processed_ids = load_processed_ids()
            log.info("─── Shard %d  Iter %d  (already processed: %d, cumulative: %d replays) ───",
                     args.shard, iteration, len(processed_ids), total_replays)

            r, rec = run_once(processed_ids, pages)
            total_replays += r; total_records += rec

            # Only primary shard rebuilds the public stats JSON to avoid conflicts
            if is_primary:
                stats = rebuild_stats_from_raw()
                save_stats(stats)
                log.info("✅ [primary] Iter %d done — window records: %d | cumulative replays: %d",
                         iteration, stats.get("totalRecords", 0), total_replays)
            else:
                log.info("✅ [shard %d] Iter %d done — cumulative replays: %d",
                         args.shard, iteration, total_replays)

            if not args.continuous:
                break
            log.info("Sleeping %ds…", LOOP_DELAY_S)
            time.sleep(LOOP_DELAY_S)

    except KeyboardInterrupt:
        log.info("Shard %d interrupted — saving state…", args.shard)
        if is_primary:
            stats = rebuild_stats_from_raw()
            save_stats(stats)
        log.info("Saved. Bye.")


if __name__ == "__main__":
    main()
