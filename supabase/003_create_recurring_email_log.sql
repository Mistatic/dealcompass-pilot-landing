-- DealCompass recurring email send history log (dedupe/idempotency support)
-- Run once in Supabase SQL Editor.

create table if not exists public.recurring_email_log (
  id bigserial primary key,
  email text not null,
  cadence text not null,
  sent_at timestamptz not null default now(),
  picks_count integer,
  interest text,
  pick_hash text,
  created_at timestamptz not null default now()
);

-- Forward-compatible column adds (safe if table already exists in another shape)
alter table public.recurring_email_log
  add column if not exists email text,
  add column if not exists cadence text,
  add column if not exists sent_at timestamptz,
  add column if not exists picks_count integer,
  add column if not exists interest text,
  add column if not exists pick_hash text,
  add column if not exists created_at timestamptz;

alter table public.recurring_email_log
  alter column email set not null,
  alter column cadence set not null;

alter table public.recurring_email_log
  alter column sent_at set default now(),
  alter column created_at set default now();

create index if not exists idx_recurring_email_log_email_cadence_sent_at
  on public.recurring_email_log (email, cadence, sent_at desc);

create index if not exists idx_recurring_email_log_sent_at
  on public.recurring_email_log (sent_at desc);

create index if not exists idx_recurring_email_log_pick_hash
  on public.recurring_email_log (pick_hash);

-- Service-role model: enable RLS, no anonymous policies.
alter table public.recurring_email_log enable row level security;
