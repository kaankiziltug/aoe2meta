#!/usr/bin/env bash
# Stop all pipeline workers gracefully
set -euo pipefail
cd "$(dirname "$0")/.."

LOG_DIR="logs"
STOPPED=0

for PID_FILE in "$LOG_DIR"/worker-*.pid; do
  [[ -f "$PID_FILE" ]] || continue
  PID=$(cat "$PID_FILE")
  SHARD=$(basename "$PID_FILE" .pid | sed 's/worker-//')
  if kill -0 "$PID" 2>/dev/null; then
    echo "⏹  Stopping shard $SHARD (PID $PID)…"
    kill -TERM "$PID" 2>/dev/null || true
    STOPPED=$((STOPPED + 1))
  else
    echo "   Shard $SHARD (PID $PID) already stopped."
  fi
  rm -f "$PID_FILE"
done

echo ""
if [[ $STOPPED -gt 0 ]]; then
  echo "✅ Stopped $STOPPED worker(s)."
else
  echo "ℹ️  No workers were running."
fi
