# DealCompass Native Forms → Google Sheet Webhook Setup

This wires `/api/signup` and `/api/feedback` to your Google Sheet, while preserving Buttondown subscriber sync.

## 1) Create Apps Script Web App
1. Open https://script.google.com
2. New project
3. Replace `Code.gs` with `docs/forms_webhook_apps_script.gs`
4. In **Project Settings → Script properties**, add:
   - `DEALCOMPASS_WEBHOOK_TOKEN=<your-secret-token>`
5. Deploy → **New deployment** → Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web App URL

## 2) Ensure Sheet Tabs/Columns
Spreadsheet ID is already set in script:
`1KrZTuMTPY6bQACR0HVO9pUfIxkyC1dM1sY84TyjCmpc`

Required tabs:
- `Sheet1` (signup)
- `DealCompass Feedback` (feedback)

First row headers can be any labels, but suggested:

### Sheet1 (signup)
`submission_id, submitted_at, user_email, user_name, interest_category, budget_range, preferred_channel, consent, campaign_id, campaign_channel, campaign_variant, source`

### DealCompass Feedback
`submission_id, submitted_at, usefulness_score, reviewed_pick, clicked_link, buy_intent, missing_or_confusing, campaign_id, campaign_channel, campaign_variant, source`

## 3) Set Vercel Environment Variables (staging + production)
- `DEALCOMPASS_FORM_WEBHOOK_URL=<apps-script-web-app-url>`
- `DEALCOMPASS_FORM_WEBHOOK_TOKEN=<same-secret-token>`
- `BUTTONDOWN_API_KEY=<existing buttondown api key>`

## 4) Validate
- Submit `/signup.html` and `/feedback.html`
- Confirm rows appear in both tabs
- Confirm signup email appears in Buttondown

## Notes
- Current API sends payload shape: `{ action, row, token }`
- If token mismatch, Apps Script returns `unauthorized`
- This keeps historical data continuity in the same Google Sheet flow used by ingest scripts.
