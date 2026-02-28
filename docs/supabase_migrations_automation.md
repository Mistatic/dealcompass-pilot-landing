# Supabase migration automation (DealCompass)

This repo supports automated SQL migrations via Supabase CLI + DB URL.

## 1) Required env vars

Set one or both:

- `SUPABASE_DB_URL_PRODUCTION`
- `SUPABASE_DB_URL_STAGING`

Fallback supported:
- `SUPABASE_DB_URL`

> Use the full Postgres connection string from Supabase (URI format).

## 2) Commands

From repo root:

```bash
# Check migration state
scripts/db/migration-status.sh production
scripts/db/migration-status.sh staging

# Apply pending migrations
scripts/db/migrate.sh production
scripts/db/migrate.sh staging
```

## 3) Recommended operating policy

1. Apply to **staging** first.
2. Verify app/API health.
3. Apply to **production**.
4. Post proof: target, timestamp, latest migration filename.

## 4) Current migration stack

- `001_create_dealcompass_forms_tables.sql`
- `002_create_affiliate_link_tables.sql`
- `003_create_recurring_email_log.sql`

Once `003` is applied, recurring email dedupe/send-history can use `public.recurring_email_log`.
