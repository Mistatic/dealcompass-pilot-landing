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

function ensureHeaders(sheet, requiredHeaders) {
  const state = headerIndexMap(sheet);
  const missing = requiredHeaders.filter((h) => !(normalize(h) in state.map));
  if (!missing.length) return headerIndexMap(sheet);

  const startCol = Math.max(1, state.headers.length) + 1;
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  return headerIndexMap(sheet);
}

function setByAliases(row, map, aliases, value) {
  for (let i = 0; i < aliases.length; i += 1) {
    const idx = map[normalize(aliases[i])];
    if (idx !== undefined) {
      row[idx] = safe(value);
      return;
    }
  }
}

function appendMappedRow(sheet, fieldMap) {
  const required = [];
  Object.keys(fieldMap).forEach((k) => {
    const aliases = fieldMap[k] && fieldMap[k].headers ? fieldMap[k].headers : [];
    if (aliases.length) required.push(aliases[0]);
  });

  const { headers, map } = ensureHeaders(sheet, required);
  const row = new Array(Math.max(1, headers.length)).fill('');

  Object.keys(fieldMap).forEach((k) => {
    const spec = fieldMap[k] || {};
    const aliases = spec.headers || [];
    const value = spec.value;
    setByAliases(row, map, aliases, value);
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

      appendMappedRow(sh, {
        submission_id: { headers: ['Submission ID'], value: row.submission_id },
        respondent_id: { headers: ['Respondent ID'], value: row.submitted_at },
        submitted_at: { headers: ['Submitted at'], value: row.submitted_at },
        email: { headers: ['E-mail', 'Email'], value: row.user_email },
        first_name: { headers: ['First Name'], value: row.user_name },
        interest: { headers: ['Primary Interest Category'], value: row.interest_category },
        budget: { headers: ['Budget Range'], value: row.budget_range },
        preferred_channel: { headers: ['Preferred Channel'], value: row.preferred_channel || 'Email' },
        consent: {
          headers: ["Type 'Yes' to consent to pilot updates", 'Type ‘Yes’ to consent to pilot updates', 'Consent'],
          value: 'YES',
        },
        campaign_id: { headers: ['dc_campaign', 'campaign_id', 'campaign'], value: row.campaign_id },
        campaign_channel: { headers: ['dc_channel', 'campaign_channel', 'channel'], value: row.campaign_channel },
        campaign_variant: { headers: ['dc_variant', 'campaign_variant', 'variant'], value: row.campaign_variant },
        source: { headers: ['source'], value: row.source || 'dealcompass_native_form' },
      });

      return jsonOut({ ok: true, action: 'signup', written: true });
    }

    if (action === 'feedback') {
      const sh = ss.getSheetByName(FEEDBACK_TAB);
      if (!sh) return jsonOut({ ok: false, error: 'missing_feedback_sheet' });

      appendMappedRow(sh, {
        submission_id: { headers: ['Submission ID'], value: row.submission_id },
        respondent_id: { headers: ['Respondent ID'], value: row.submitted_at },
        submitted_at: { headers: ['Submitted at'], value: row.submitted_at },
        usefulness_score: { headers: ['Usefulness Score (1-5)'], value: row.usefulness_score },
        reviewed_pick: { headers: ['Which pick did you review?'], value: row.reviewed_pick },
        clicked_link: { headers: ['Did you click a link?'], value: row.clicked_link },
        buy_intent: { headers: ['Would you consider buying?'], value: row.buy_intent },
        missing: { headers: ['What was missing or confusing?'], value: row.missing_or_confusing },
        campaign_id: { headers: ['dc_campaign', 'campaign_id', 'campaign'], value: row.campaign_id },
        campaign_channel: { headers: ['dc_channel', 'campaign_channel', 'channel'], value: row.campaign_channel },
        campaign_variant: { headers: ['dc_variant', 'campaign_variant', 'variant'], value: row.campaign_variant },
        source: { headers: ['source'], value: row.source || 'dealcompass_native_form' },
      });

      return jsonOut({ ok: true, action: 'feedback', written: true });
    }

    return jsonOut({ ok: false, error: 'invalid_action' });
  } catch (err) {
    return jsonOut({ ok: false, error: 'server_error', detail: String((err && err.message) || err) });
  }
}
