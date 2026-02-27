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

  // New post-pilot signup fields
  const primaryInterest = sanitize(
    body.primary_interest || body.primaryInterest || body.interest_category || body.interestCategory,
    120
  );
  const primaryGoal = sanitize(body.primary_goal || body.primaryGoal, 120);
  const requestedCategories = sanitize(body.requested_categories || body.requestedCategories, 220);
  const updateFrequency = sanitize(body.update_frequency || body.updateFrequency, 120);
  const deliveryPreference = sanitize(
    body.delivery_preference || body.deliveryPreference || body.preferred_channel || body.preferredChannel,
    120
  );
  const biggestPain = sanitize(body.biggest_pain || body.biggestPain, 320);

  const consent = asBool(body.consent);
  const campaignId = sanitize(body.dc_campaign || body.campaign_id || body.utm_campaign, 120);
  const campaignChannel = sanitize(body.dc_channel || body.channel || body.utm_source, 120);
  const campaignVariant = sanitize(body.dc_variant || body.variant || body.utm_content, 120);

  if (!emailOk(email)) return json(res, 400, { ok: false, error: 'invalid_email' });
  if (!primaryInterest) return json(res, 400, { ok: false, error: 'missing_primary_interest' });
  if (!primaryGoal) return json(res, 400, { ok: false, error: 'missing_primary_goal' });
  if (!consent) return json(res, 400, { ok: false, error: 'consent_required' });

  const submissionId = makeSubmissionId('signup');
  const submittedAt = nowIso();

  const row = {
    submission_id: submissionId,
    submitted_at: submittedAt,
    form_type: 'signup',
    user_email: email,
    user_name: firstName,

    // Updated signup signal fields
    primary_interest: primaryInterest,
    primary_goal: primaryGoal,
    requested_categories: requestedCategories,
    update_frequency: updateFrequency,
    delivery_preference: deliveryPreference,
    biggest_pain: biggestPain,

    // Compatibility fields (for legacy sheet mappings/reporting)
    interest_category: primaryInterest,
    budget_range: updateFrequency,
    preferred_channel: deliveryPreference,

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
    { action: 'signup', row, token: webhookToken || undefined }
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
    if (primaryInterest) tags.push(`interest:${primaryInterest.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

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
          primary_interest: primaryInterest || undefined,
          primary_goal: primaryGoal || undefined,
          requested_categories: requestedCategories || undefined,
          update_frequency: updateFrequency || undefined,
          delivery_preference: deliveryPreference || undefined,
          biggest_pain: biggestPain || undefined,

          // Compatibility mirrors
          preferred_channel: deliveryPreference || undefined,
          interest_category: primaryInterest || undefined,
          budget_range: updateFrequency || undefined,
        },
      },
      {
        Authorization: `Token ${buttondownKey}`,
      }
    );
  }

  return json(res, 200, { ok: true, submission_id: submissionId });
};
