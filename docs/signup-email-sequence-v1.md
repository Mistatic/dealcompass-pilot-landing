# DealCompass Signup Email Sequence v1

Updated: 2026-02-27
Owner: DealCompass growth ops

## Goal
Send clear, useful onboarding emails immediately after signup and during the first week so new subscribers understand what to expect and engage quickly.

## Automation design (Loops)

### Trigger A — event-based onboarding
- Event name: `dealcompass_signup` (default)
- Sent by API: `POST /api/signup` -> `https://app.loops.so/api/v1/events/send`
- Use this event to trigger a Loops journey/campaign sequence.

### Trigger B — immediate transactional welcome (optional)
- Env var: `LOOPS_SIGNUP_WELCOME_TRANSACTIONAL_ID`
- If set, `/api/signup` sends one transactional email immediately after signup.
- Endpoint used: `https://app.loops.so/api/v1/transactional`

## Required env vars
- `LOOPS_API_KEY` (required)
- `LOOPS_SIGNUP_EVENT_NAME` (optional, default: `dealcompass_signup`)
- `LOOPS_SIGNUP_WELCOME_TRANSACTIONAL_ID` (optional, enables instant transactional send)

---

## Email 1 — Immediate Welcome
**Subject options**
1. Welcome to DealCompass — here’s what you’ll get
2. You’re in. We’ll keep your deal research short and useful
3. Thanks for joining DealCompass

**Preview text**
You’ll get concise verdict-first deal updates, not noisy promo blasts.

**Body (plain copy)**
Hi {{firstName | default: "there"}},

Welcome to DealCompass.

Our goal is simple: help you make better buying decisions faster with concise verdicts and signal-based picks.

What to expect:
- Practical recommendations (not hype)
- Clear tradeoffs and who each pick is for
- Focus on value, utility, and desirability

Based on your signup, we’ll bias updates toward **{{primaryInterest}}** and keep cadence around **{{updateFrequency}}**.

Quick links:
- Current picks: https://dealcompass.app/current-picks.html
- Our verdicts: https://dealcompass.app/reviews.html
- Share feedback: https://dealcompass.app/feedback.html

Thanks again — and if you reply with what category you want next, we’ll prioritize it.

— DealCompass

---

## Email 2 — How to use DealCompass (Day 2)
**Subject options**
1. How to get the most out of DealCompass in 2 minutes
2. Quick way to read our picks and verdicts

**Preview text**
A simple workflow to decide faster: shortlist, compare, commit.

**Body**
Hi {{firstName | default: "there"}},

Here’s the fastest way to use DealCompass:

1) Start at Current Picks for top opportunities:
https://dealcompass.app/current-picks.html

2) Open Our Verdicts for deeper context:
https://dealcompass.app/reviews.html

3) Decide with confidence by checking:
- Best fit use-case
- Tradeoffs/limitations
- Price-to-value signal

If something feels missing, tell us directly:
https://dealcompass.app/feedback.html

We use this to prioritize product categories and verdict depth.

— DealCompass

---

## Email 3 — Preference + category expansion prompt (Day 5)
**Subject options**
1. Want us to add a category next?
2. Help shape upcoming DealCompass coverage

**Preview text**
Tell us what to launch next and how often you want updates.

**Body**
Hi {{firstName | default: "there"}},

Thanks again for joining DealCompass.

We’re actively expanding coverage and tuning our update cadence.

If you have 20 seconds, tell us:
- Which category we should add next
- Whether you want weekly, twice-weekly, or high-signal-only updates

Feedback form:
https://dealcompass.app/feedback.html

Your input directly impacts what we publish next.

— DealCompass

---

## Variable map from signup API payload
The signup API currently provides Loops with these fields:
- `firstName`
- `primary_interest`
- `primary_goal`
- `requested_categories`
- `update_frequency`
- `delivery_preference`
- `campaign_id`
- `campaign_channel`
- `campaign_variant`

For transactional templates, API sends dataVariables:
- `firstName`
- `primaryInterest`
- `primaryGoal`
- `requestedCategories`
- `updateFrequency`
- `manageUrl`
- `feedbackUrl`

## QA checklist
1. Use `@example.com` for dry-run transactional testing.
2. Submit `/signup.html` with test UTM params.
3. Confirm API response includes `loops.contact_sync` and `loops.signup_event` statuses.
4. If transactional ID is configured, confirm `loops.welcome_transactional.status=200`.
5. Verify contact + event + journey step in Loops UI.
