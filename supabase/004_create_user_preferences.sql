-- DealCompass canonical user communication preferences
-- Run once in Supabase SQL Editor.

create table if not exists public.user_preferences (
  id bigserial primary key,
  email text not null unique,
  first_name text,
  primary_interest text not null default 'all',
  update_frequency text not null default 'weekly_digest',
  delivery_preference text not null default 'email',
  status text not null default 'active',
  source text default 'signup',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_preferences_status_updated
  on public.user_preferences (status, updated_at desc);

create index if not exists idx_user_preferences_interest_cadence
  on public.user_preferences (primary_interest, update_frequency);

alter table public.user_preferences enable row level security;
