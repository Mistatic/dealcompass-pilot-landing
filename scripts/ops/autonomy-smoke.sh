#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
SECRETS_FILE="/Users/clayspicer/.openclaw/workspace/.secrets/autonomy.env"

if [[ -f "$SECRETS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "❌ Missing VERCEL_TOKEN"
  exit 1
fi

echo "== Vercel auth check =="
vercel env ls production --token "$VERCEL_TOKEN" >/dev/null
echo "✅ Vercel env access OK"

echo "== Recurring cadence endpoint health =="
for c in weekly_digest twice_weekly high_signal_only; do
  ok=$(curl -sL "https://dealcompass.app/api/recurring-cadence?cadence=$c&dry_run=1" | python3 -c 'import sys,json; j=json.load(sys.stdin); print("ok" if j.get("ok") else "fail")')
  echo "- $c: $ok"
done

echo "== Supabase migration connectivity check =="
if [[ -n "${SUPABASE_DB_URL_PRODUCTION:-}" ]]; then
  if npx --yes supabase migration list --db-url "$SUPABASE_DB_URL_PRODUCTION" >/tmp/supabase_mig_check.out 2>&1; then
    echo "✅ Supabase migration connectivity OK"
  else
    echo "⚠️ Supabase migration connectivity failed (see /tmp/supabase_mig_check.out)"
  fi
else
  echo "⚠️ SUPABASE_DB_URL_PRODUCTION not set"
fi

echo "Done."
