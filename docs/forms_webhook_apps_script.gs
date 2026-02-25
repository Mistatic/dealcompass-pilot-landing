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

function jsonOut(code, payload) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: code >= 200 && code < 300, ...payload }))
    .setMimeType(ContentService.MimeType.JSON);
}

function safe(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\r\n]+/g, ' ').trim();
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = safe(body.action).toLowerCase();
    const row = body.row || {};
    const token = safe(body.token);

    const expected = PropertiesService.getScriptProperties().getProperty('DEALCOMPASS_WEBHOOK_TOKEN') || '';
    if (!expected || token !== expected) {
      return jsonOut(401, { error: 'unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);

    if (action === 'signup') {
      const sh = ss.getSheetByName(SIGNUP_TAB);
      if (!sh) return jsonOut(500, { error: 'missing_signup_sheet' });

      sh.appendRow([
        safe(row.submission_id),
        safe(row.submitted_at),
        safe(row.user_email),
        safe(row.user_name),
        safe(row.interest_category),
        safe(row.budget_range),
        safe(row.preferred_channel),
        safe(row.consent),
        safe(row.campaign_id),
        safe(row.campaign_channel),
        safe(row.campaign_variant),
        safe(row.source),
      ]);

      return jsonOut(200, { action: 'signup', written: true });
    }

    if (action === 'feedback') {
      const sh = ss.getSheetByName(FEEDBACK_TAB);
      if (!sh) return jsonOut(500, { error: 'missing_feedback_sheet' });

      sh.appendRow([
        safe(row.submission_id),
        safe(row.submitted_at),
        safe(row.usefulness_score),
        safe(row.reviewed_pick),
        safe(row.clicked_link),
        safe(row.buy_intent),
        safe(row.missing_or_confusing),
        safe(row.campaign_id),
        safe(row.campaign_channel),
        safe(row.campaign_variant),
        safe(row.source),
      ]);

      return jsonOut(200, { action: 'feedback', written: true });
    }

    return jsonOut(400, { error: 'invalid_action' });
  } catch (err) {
    return jsonOut(500, { error: 'server_error', detail: String(err && err.message || err) });
  }
}
