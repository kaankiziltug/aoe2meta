#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start-workers.sh  —  Launch N parallel pipeline workers
#
# Usage:
#   ./scripts/start-workers.sh          # 4 workers (default)
#   ./scripts/start-workers.sh 6        # 6 workers
#   ./scripts/start-workers.sh 1        # single worker (same as old behaviour)
#
# Each worker covers a different slice of the leaderboard:
#   Shard 0: pages 1–50   → rank    1–2500  (1800+ ELO)
#   Shard 1: pages 51–100 → rank 2501–5000  (~1600+ ELO)
#   Shard 2: pages 101–150→ rank 5001–7500  (~1400+ ELO)
#   Shard 3: pages 151–200→ rank 7501–10000 (~1200+ ELO)
#
# Logs go to logs/worker-N.log  (rotated each run)
# PIDs stored in  logs/worker-N.pid
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

NUM_WORKERS="${1:-4}"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"

echo "🚀 Starting $NUM_WORKERS pipeline workers…"

for i in $(seq 0 $((NUM_WORKERS - 1))); do
  LOG_FILE="$LOG_DIR/worker-${i}.log"
  PID_FILE="$LOG_DIR/worker-${i}.pid"

  # Kill existing worker for this shard if running
  if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
      echo "  ⏹  Stopping old shard $i (PID $OLD_PID)…"
      kill -TERM "$OLD_PID" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi

  echo "  ▶  Shard $i → pages $(( i * 50 + 1 ))–$(( (i + 1) * 50 ))  log: $LOG_FILE"
  python3 scripts/fetch-strategy-stats.py \
    --continuous \
    --shard "$i" \
    --num-shards "$NUM_WORKERS" \
    --pages-per-shard 50 \
    >> "$LOG_FILE" 2>&1 &

  echo $! > "$PID_FILE"
  echo "     PID: $(cat "$PID_FILE")"

  # Stagger worker starts by 3s to avoid simultaneous leaderboard hammering
  if [[ $i -lt $((NUM_WORKERS - 1)) ]]; then
    sleep 3
  fi
done

echo ""
echo "✅ $NUM_WORKERS workers running."
echo ""
echo "📋 Monitor logs:"
for i in $(seq 0 $((NUM_WORKERS - 1))); do
  echo "   tail -f logs/worker-${i}.log"
done
echo ""
echo "⏹  Stop all workers:"
echo "   ./scripts/stop-workers.sh"
