# Loops Signup Email Design System v1

Updated: 2026-02-27
Branch: staging

## Objective
Deliver onboarding emails that automatically match what each user selected on `/signup.html`:
- `primary_interest`
- `primary_goal`
- `update_frequency`
- `delivery_preference`
- `requested_categories`

## Where personalization is computed
- API module: `api/_signup_email_profile.js`
- Called by: `api/signup.js`

The backend maps raw option values into ready-to-render copy fields so Loops templates can stay simple.

## Template files (ready to paste/import into Loops)
- `emails/loops/signup-welcome-v1.html`
- `emails/loops/signup-day2-v1.html`
- `emails/loops/signup-day5-v1.html`
- Transactional branded baseline (published in Loops): `emails/loops/signup-welcome-transactional-v2.mjml`

## Brand consistency policy (Clay directive, 2026-02-27)
Use one unified DealCompass email visual system for all sends going forward:
- Website-aligned top brand treatment (logo + DealCompass wordmark style)
- Dark navy base + blue accent palette aligned to site theme
- Consistent card, button, and footer styling across welcome/day2/day5 and future campaigns

## Variables available in Loops
### Core profile
- `interest_key`, `interest_label`, `interest_headline`, `interest_description`
- `recommended_page_label`, `recommended_page_url`
- `goal_key`, `goal_label`, `goal_focus_line`
- `cadence_key`, `cadence_label`, `cadence_line`, `cadence_frequency_hint`
- `delivery_key`, `delivery_label`, `delivery_line`
- `requested_categories_normalized`, `requested_categories_line`

### Existing signup fields
- `primary_interest`, `primary_goal`, `requested_categories`
- `update_frequency`, `delivery_preference`
- `campaign_id`, `campaign_channel`, `campaign_variant`

### Utility links
- `manageUrl` (`https://dealcompass.app/signup.html`)
- `feedbackUrl` (`https://dealcompass.app/feedback.html`)
- `reviewsUrl` (`https://dealcompass.app/reviews.html`)
- `currentPicksUrl` (`https://dealcompass.app/current-picks.html`)

## Loops setup plan
1. **Transactional template** (optional immediate send)
   - Create template: "DealCompass Signup Welcome v1"
   - Paste `emails/loops/signup-welcome-v1.html`
   - Save published template id to env: `LOOPS_SIGNUP_WELCOME_TRANSACTIONAL_ID`

2. **Journey/campaign based on event**
   - Trigger event: `dealcompass_signup` (or env override `LOOPS_SIGNUP_EVENT_NAME`)
   - Step A: Send Email "Signup Welcome v1" (or skip if using transactional)
   - Delay 2 days -> Send `signup-day2-v1.html`
   - Delay 3 days -> Send `signup-day5-v1.html`

3. **Segment sanity checks**
   - Confirm substitutions render for all enum options:
     - Interests: tech/home/all/new_categories
     - Goal: save_time/best_value/trusted_verdicts/discover_categories
     - Cadence: weekly_digest/twice_weekly/high_signal_only
     - Delivery: email/email_plus_telegram

## Recurring cadence engine (production)
- API route: `/api/recurring-cadence`
- Cadence query values:
  - `weekly_digest`
  - `twice_weekly`
  - `high_signal_only`
- Schedule (Vercel Cron, UTC):
  - Weekly: Monday 13:00
  - Twice weekly: Tuesday + Friday 13:00
  - High signal: Daily 13:30

### Category-safe targeting contract
- `tech` / `home` / future specific slug → only that category
- `all` (scalable replacement for legacy `both`) → mixed active categories
- `new_categories` → only categories outside `CORE_CATEGORY_SLUGS` (default `tech,home`)
- Legacy `both` values are normalized to `all` in backend

### Required env vars for recurring sends
- `LOOPS_API_KEY`
- `LOOPS_RECURRING_TEMPLATE_WEEKLY`
- `LOOPS_RECURRING_TEMPLATE_TWICE_WEEKLY`
- `LOOPS_RECURRING_TEMPLATE_HIGH_SIGNAL`

Optional:
- `CORE_CATEGORY_SLUGS` (default: `tech,home`)
- `RECURRING_CADENCE_SECRET` (protect manual trigger calls)
- `HIGH_SIGNAL_MAX_AGE_HOURS` (default: `72`, filters high-signal to recent picks)
- `RECURRING_ALERT_WEBHOOK_URL` (JSON webhook for run summaries/failures)
- `RECURRING_DEDUPE_WINDOW_HOURS` (default: `20`, cadence send guard window)

Optional Supabase table for idempotency/send history:
- `recurring_email_log(email text, cadence text, sent_at timestamptz, picks_count int, interest text, pick_hash text)`
- If present, API enforces recent-send guard and logs successful sends.
- If absent, API continues safely without hard failure.

## Preferences center (production)
- Public page: `/preferences.html`
- API route: `/api/preferences`
- Tokenized link model:
  - `manage_preferences_url` is generated server-side and sent to Loops as contact/event/data variable.
  - Link carries signed token (`?t=...`) based on `PREFS_TOKEN_SECRET`.
- Canonical preference store: `public.user_preferences`
- Signup API upserts `user_preferences`; preferences API updates `user_preferences` + Loops contact properties.

Required env:
- `PREFS_TOKEN_SECRET`
- `SITE_BASE_URL` (recommended, default `https://dealcompass.app`)

## QA checklist
- Submit test signups for each enum combination (or representative matrix).
- Verify API response includes `signup_profile` and `loops` status blocks.
- In Loops contact profile, confirm mapped fields persisted including `manage_preferences_url`.
- Open `/preferences.html?t=<token>` and confirm GET loads current values.
- Save preference changes and confirm:
  - `user_preferences` row updates
  - Loops contact fields update (`primary_interest`, `update_frequency`, `delivery_preference`, `preference_status`).
- Trigger event journey and verify email copy matches selected options.
- Trigger dry runs:
  - `/api/recurring-cadence?cadence=weekly_digest&dry_run=1`
  - `/api/recurring-cadence?cadence=twice_weekly&dry_run=1`
  - `/api/recurring-cadence?cadence=high_signal_only&dry_run=1`
- Confirm dry-run totals and sample rows match expected segment + category rules.
