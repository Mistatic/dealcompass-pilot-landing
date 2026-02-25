/**
 * DealCompass Forms Webhook (Google Apps Script)
 *
 * Deploy as Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Script Properties required:
 * - DEALCOMPASS_WEBHOOK_TOKEN = <shared secret token>
 */

const SHEET_ID = '1KrZTuMTPY6bQACR0HVO9pUfIxkyC1dM1sY84TyjCmpc';
const SIGNUP_TAB = 'Sheet1';
const FEEDBACK_TAB = 'DealCompass Feedback';

function jsonOut(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function safe(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\r\n]+/g, ' ').trim();
}

function normalize(h) {
  return safe(h).toLowerCase();
}

function headerIndexMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const map = {};
  headers.forEach((h, i) => {
    const k = normalize(h);
    if (k) map[k] = i;
  });
  return { headers, map };
}

function appendByHeaders(sheet, valuesByHeader) {
  const { headers, map } = headerIndexMap(sheet);
  const row = new Array(Math.max(1, headers.length)).fill('');
  Object.keys(valuesByHeader).forEach((key) => {
    const idx = map[normalize(key)];
    if (idx !== undefined) row[idx] = safe(valuesByHeader[key]);
  });
  sheet.appendRow(row);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = safe(body.action).toLowerCase();
    const row = body.row || {};
    const token = safe(body.token);

    const expected = PropertiesService.getScriptProperties().getProperty('DEALCOMPASS_WEBHOOK_TOKEN') || '';
    if (!expected || token !== expected) {
      return jsonOut({ ok: false, error: 'unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);

    if (action === 'signup') {
      const sh = ss.getSheetByName(SIGNUP_TAB);
      if (!sh) return jsonOut({ ok: false, error: 'missing_signup_sheet' });

      appendByHeaders(sh, {
        'Submission ID': row.submission_id,
        'Respondent ID': row.submitted_at,
        'Submitted at': row.submitted_at,
        'E-mail': row.user_email,
        'First Name': row.user_name,
        'Primary Interest Category': row.interest_category,
        'Budget Range': row.budget_range,
        'Preferred Channel': row.preferred_channel || 'Email',
        "Type 'Yes' to consent to pilot updates": row.consent,
        'dc_campaign': row.campaign_id,
        'dc_channel': row.campaign_channel,
        'dc_variant': row.campaign_variant,
        'source': row.source,
      });

      return jsonOut({ ok: true, action: 'signup', written: true });
    }

    if (action === 'feedback') {
      const sh = ss.getSheetByName(FEEDBACK_TAB);
      if (!sh) return jsonOut({ ok: false, error: 'missing_feedback_sheet' });

      appendByHeaders(sh, {
        'Submission ID': row.submission_id,
        'Respondent ID': row.submitted_at,
        'Submitted at': row.submitted_at,
        'Usefulness Score (1-5)': row.usefulness_score,
        'Which pick did you review?': row.reviewed_pick,
        'Did you click a link?': row.clicked_link,
        'Would you consider buying?': row.buy_intent,
        'What was missing or confusing?': row.missing_or_confusing,
        'dc_campaign': row.campaign_id,
        'dc_channel': row.campaign_channel,
        'dc_variant': row.campaign_variant,
        'source': row.source,
      });

      return jsonOut({ ok: true, action: 'feedback', written: true });
    }

    return jsonOut({ ok: false, error: 'invalid_action' });
  } catch (err) {
    return jsonOut({ ok: false, error: 'server_error', detail: String((err && err.message) || err) });
  }
}
