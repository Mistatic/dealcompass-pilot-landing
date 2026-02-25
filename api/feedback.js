const {
  json,
  readBody,
  sanitize,
  postJson,
  nowIso,
  makeSubmissionId,
} = require('./_shared');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message || 'bad_request' });
  }

  const score = Number(body.usefulness_score);
  const reviewedPick = sanitize(body.reviewed_pick, 180);
  const clicked = sanitize(body.clicked_link, 20);
  const buyIntent = sanitize(body.buy_intent, 20);
  const note = sanitize(body.missing_or_confusing, 500);
  const campaignId = sanitize(body.dc_campaign || body.campaign_id || body.utm_campaign, 120);
  const campaignChannel = sanitize(body.dc_channel || body.channel || body.utm_source, 120);
  const campaignVariant = sanitize(body.dc_variant || body.variant || body.utm_content, 120);

  if (!(score >= 1 && score <= 5)) return json(res, 400, { ok: false, error: 'invalid_score' });

  const submissionId = makeSubmissionId('feedback');
  const submittedAt = nowIso();

  const row = {
    submission_id: submissionId,
    submitted_at: submittedAt,
    form_type: 'feedback',
    usefulness_score: String(score),
    reviewed_pick: reviewedPick,
    clicked_link: clicked,
    buy_intent: buyIntent,
    missing_or_confusing: note,
    campaign_id: campaignId,
    campaign_channel: campaignChannel,
    campaign_variant: campaignVariant,
    source: 'dealcompass_native_form',
  };

  const webhook = process.env.DEALCOMPASS_FORM_WEBHOOK_URL;
  if (!webhook) return json(res, 500, { ok: false, error: 'missing_form_webhook' });

  const webhookToken = process.env.DEALCOMPASS_FORM_WEBHOOK_TOKEN || '';
  const sheetResp = await postJson(
    webhook,
    { action: 'feedback', row },
    webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}
  );

  if (!sheetResp.ok) {
    return json(res, 502, { ok: false, error: 'sheet_write_failed', detail: sheetResp.body || null });
  }

  return json(res, 200, { ok: true, submission_id: submissionId });
};
