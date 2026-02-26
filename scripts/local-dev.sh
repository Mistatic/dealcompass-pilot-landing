#!/usr/bin/env bash
set -euo pipefail

# Local dev runner for DealCompass landing site.
# Usage:
#   ./scripts/local-dev.sh static [port]
#   ./scripts/local-dev.sh vercel [port]

MODE="${1:-static}"
PORT="${2:-4173}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

case "$MODE" in
  static)
    echo "Starting static preview at http://127.0.0.1:${PORT}"
    echo "(Use Ctrl+C to stop)"
    exec python3 -m http.server "$PORT"
    ;;
  vercel)
    if ! command -v vercel >/dev/null 2>&1; then
      echo "Error: vercel CLI not found. Install with: npm i -g vercel"
      exit 1
    fi
    echo "Starting Vercel dev at http://127.0.0.1:${PORT}"
    echo "(Use Ctrl+C to stop)"
    exec vercel dev --listen "$PORT"
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: ./scripts/local-dev.sh [static|vercel] [port]"
    exit 1
    ;;
esac
