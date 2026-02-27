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

  const confidenceScore = Number(body.confidence_score || body.usefulness_score);
  const feedbackFocus = sanitize(body.feedback_focus, 60);
  const requestedCategory = sanitize(body.requested_category, 120);
  const whatWorked = sanitize(body.what_worked, 220);
  const whatToImprove = sanitize(body.what_to_improve || body.missing_or_confusing, 700);
  const featureRequest = sanitize(body.feature_request, 700);
  const campaignId = sanitize(body.dc_campaign || body.campaign_id || body.utm_campaign, 120);
  const campaignChannel = sanitize(body.dc_channel || body.channel || body.utm_source, 120);
  const campaignVariant = sanitize(body.dc_variant || body.variant || body.utm_content, 120);

  if (!(confidenceScore >= 1 && confidenceScore <= 5)) return json(res, 400, { ok: false, error: 'invalid_confidence_score' });
  if (!feedbackFocus) return json(res, 400, { ok: false, error: 'missing_feedback_focus' });
  if (!whatToImprove) return json(res, 400, { ok: false, error: 'missing_what_to_improve' });

  const submissionId = makeSubmissionId('feedback');
  const submittedAt = nowIso();

  const row = {
    submission_id: submissionId,
    submitted_at: submittedAt,
    form_type: 'feedback',
    confidence_score: String(confidenceScore),
    feedback_focus: feedbackFocus,
    requested_category: requestedCategory,
    what_worked: whatWorked,
    what_to_improve: whatToImprove,
    feature_request: featureRequest,
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
    { action: 'feedback', row, token: webhookToken || undefined }
  );

  if (!sheetResp.ok) {
    return json(res, 502, { ok: false, error: 'sheet_write_failed', detail: sheetResp.body || null });
  }

  return json(res, 200, { ok: true, submission_id: submissionId });
};
