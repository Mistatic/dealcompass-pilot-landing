#!/usr/bin/env bash
set -euo pipefail

# Show local vs remote migration status for target DB.
# Usage:
#   scripts/db/migration-status.sh production

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TARGET="${1:-production}"
TARGET_UPPER="$(printf '%s' "$TARGET" | tr '[:lower:]' '[:upper:]')"
TARGET_VAR="SUPABASE_DB_URL_${TARGET_UPPER}"
DB_URL="${!TARGET_VAR:-${SUPABASE_DB_URL:-}}"

if [[ -z "${DB_URL}" ]]; then
  echo "❌ Missing DB URL. Set ${TARGET_VAR} (preferred) or SUPABASE_DB_URL." >&2
  exit 1
fi

npx --yes supabase migration list --db-url "$DB_URL"
