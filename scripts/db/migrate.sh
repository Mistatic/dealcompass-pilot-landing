#!/usr/bin/env bash
set -euo pipefail

# Apply Supabase SQL migrations to a remote DB using Supabase CLI.
#
# Usage:
#   scripts/db/migrate.sh production
#   scripts/db/migrate.sh staging
#
# Env options:
#   SUPABASE_DB_URL_PRODUCTION
#   SUPABASE_DB_URL_STAGING
#   SUPABASE_DB_URL (fallback)

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

if ! command -v npx >/dev/null 2>&1; then
  echo "❌ npx is required (Node.js/npm not found)." >&2
  exit 1
fi

echo "▶ Applying migrations to target=${TARGET}"
npx --yes supabase migration up --db-url "$DB_URL"
echo "✅ Migration apply complete (${TARGET})"
