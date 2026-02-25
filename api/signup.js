const {
  json,
  readBody,
  sanitize,
  emailOk,
  asBool,
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

  const email = sanitize(body.email, 180).toLowerCase();
  const firstName = sanitize(body.first_name || body.firstName, 120);
  const interest = sanitize(body.interest_category || body.interestCategory, 120);
  const budget = sanitize(body.budget_range || body.budgetRange, 120);
  const preferredChannel = sanitize(body.preferred_channel || body.preferredChannel, 120);
  const consent = asBool(body.consent);
  const campaignId = sanitize(body.dc_campaign || body.campaign_id || body.utm_campaign, 120);
  const campaignChannel = sanitize(body.dc_channel || body.channel || body.utm_source, 120);
  const campaignVariant = sanitize(body.dc_variant || body.variant || body.utm_content, 120);

  if (!emailOk(email)) return json(res, 400, { ok: false, error: 'invalid_email' });
  if (!consent) return json(res, 400, { ok: false, error: 'consent_required' });

  const submissionId = makeSubmissionId('signup');
  const submittedAt = nowIso();

  const row = {
    submission_id: submissionId,
    submitted_at: submittedAt,
    form_type: 'signup',
    user_email: email,
    user_name: firstName,
    interest_category: interest,
    budget_range: budget,
    preferred_channel: preferredChannel,
    consent: 'YES',
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
    { action: 'signup', row },
    webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}
  );

  if (!sheetResp.ok) {
    return json(res, 502, { ok: false, error: 'sheet_write_failed', detail: sheetResp.body || null });
  }

  // Keep Buttondown list update in the same flow.
  const buttondownKey = process.env.BUTTONDOWN_API_KEY;
  if (buttondownKey) {
    const tags = ['dealcompass', 'signup'];
    if (campaignChannel) tags.push(`ch:${campaignChannel}`);
    if (campaignVariant) tags.push(`var:${campaignVariant}`);
    await postJson(
      'https://api.buttondown.email/v1/subscribers',
      {
        email,
        first_name: firstName || undefined,
        tags,
        metadata: {
          source: 'dealcompass_native_form',
          campaign_id: campaignId || undefined,
          campaign_channel: campaignChannel || undefined,
          campaign_variant: campaignVariant || undefined,
          preferred_channel: preferredChannel || undefined,
          interest_category: interest || undefined,
          budget_range: budget || undefined,
        },
      },
      {
        Authorization: `Token ${buttondownKey}`,
      }
    );
  }

  return json(res, 200, { ok: true, submission_id: submissionId });
};
