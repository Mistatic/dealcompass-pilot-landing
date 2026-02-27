#!/usr/bin/env bash
set -euo pipefail

# Stop local dev server by port.
# Usage: ./scripts/local-dev-stop.sh [port]

PORT="${1:-4173}"
PIDS="$(lsof -ti tcp:"$PORT" || true)"

if [[ -z "$PIDS" ]]; then
  echo "No process found on port $PORT"
  exit 0
fi

echo "Stopping process(es) on port $PORT: $PIDS"
kill $PIDS
