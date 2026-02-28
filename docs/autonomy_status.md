# DealCompass Autonomy Status

## Completed
- Vercel token-based automation is configured (`VERCEL_TOKEN` in local secrets).
- Recurring email engine and cadence jobs are live and healthy.
- Supabase migration SQL for recurring dedupe log has been executed in dashboard and committed to repo (`supabase/003_create_recurring_email_log.sql`).
- Automated smoke script added: `scripts/ops/autonomy-smoke.sh`
  - checks Vercel env access
  - checks recurring cadence endpoint health
  - checks Supabase migration connectivity

## Current blocker to fully headless DB migrations
- `SUPABASE_DB_URL_PRODUCTION` currently points at direct DB host (`db.<ref>.supabase.co`) which is IPv6-only from this runtime and fails connectivity.
- To enable unattended migration execution from CLI, use Supabase **pooler/IPv4 URI** in `SUPABASE_DB_URL_PRODUCTION`.

Expected format:
`postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?sslmode=require`

## Runbook
- Health check: `scripts/ops/autonomy-smoke.sh`
- Apply migrations: `scripts/db/migrate.sh production`
- Migration status: `scripts/db/migration-status.sh production`
