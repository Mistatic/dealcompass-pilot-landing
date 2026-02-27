-- DealCompass forms storage (signup + feedback)
-- Run in Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.signup_submissions (
  id bigserial primary key,
  submission_id text not null unique,
  submitted_at timestamptz not null,
  form_type text not null default 'signup',
  user_email text not null,
  user_name text,

  primary_interest text,
  primary_goal text,
  requested_categories text,
  update_frequency text,
  delivery_preference text,
  biggest_pain text,

  -- compatibility mirrors
  interest_category text,
  budget_range text,
  preferred_channel text,

  consent text not null default 'YES',
  campaign_id text,
  campaign_channel text,
  campaign_variant text,
  source text,

  created_at timestamptz not null default now()
);

create index if not exists idx_signup_submissions_submitted_at on public.signup_submissions (submitted_at desc);
create index if not exists idx_signup_submissions_campaign on public.signup_submissions (campaign_id, campaign_channel, campaign_variant);
create index if not exists idx_signup_submissions_email on public.signup_submissions (user_email);

create table if not exists public.feedback_submissions (
  id bigserial primary key,
  submission_id text not null unique,
  submitted_at timestamptz not null,
  form_type text not null default 'feedback',

  confidence_score text not null,
  feedback_focus text not null,
  requested_category text,
  what_worked text,
  what_to_improve text not null,
  feature_request text,

  campaign_id text,
  campaign_channel text,
  campaign_variant text,
  source text,

  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_submissions_submitted_at on public.feedback_submissions (submitted_at desc);
create index if not exists idx_feedback_submissions_focus on public.feedback_submissions (feedback_focus);
create index if not exists idx_feedback_submissions_campaign on public.feedback_submissions (campaign_id, campaign_channel, campaign_variant);

-- Service-role-only write model (RLS on, no public policies)
alter table public.signup_submissions enable row level security;
alter table public.feedback_submissions enable row level security;
