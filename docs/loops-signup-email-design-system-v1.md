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
     - Interests: tech/home/both/new_categories
     - Goal: save_time/best_value/trusted_verdicts/discover_categories
     - Cadence: weekly_digest/twice_weekly/high_signal_only
     - Delivery: email/email_plus_telegram

## QA checklist
- Submit test signups for each enum combination (or representative matrix).
- Verify API response includes `signup_profile` and `loops` status blocks.
- In Loops contact profile, confirm mapped fields persisted.
- Trigger event journey and verify email copy matches selected options.
