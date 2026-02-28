-- DealCompass affiliate link source-of-truth tables (Supabase)
-- Run once in Supabase SQL Editor.

create table if not exists public.affiliate_links_live (
  id bigserial primary key,
  generated_rank integer,
  rank integer,
  title text,
  generated_title text,
  url text not null,
  blurb text,
  generated_blurb text,
  category text not null default 'tech',
  active boolean not null default true,
  source text default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_affiliate_links_live_url_category
  on public.affiliate_links_live (url, category);
create index if not exists idx_affiliate_links_live_active_category_rank
  on public.affiliate_links_live (active, category, generated_rank, rank);

create table if not exists public.affiliate_links_past (
  id bigserial primary key,
  url text not null,
  category text not null default 'tech',
  title text,
  blurb text,
  retired_at timestamptz,
  ended_at timestamptz,
  source_tab text,
  source_row text,
  notes text,
  original_rank text,
  rank text,
  asin text,
  status text default 'archived',
  source text default 'archive_pipeline',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_affiliate_links_past_url_category
  on public.affiliate_links_past (url, category);
create index if not exists idx_affiliate_links_past_category_retired
  on public.affiliate_links_past (category, retired_at desc, created_at desc);

-- Service-role model: enable RLS, no anonymous policies.
alter table public.affiliate_links_live enable row level security;
alter table public.affiliate_links_past enable row level security;
