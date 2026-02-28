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
const { supabaseConfig, supabaseInsert } = require('./_supabase');

function cleanUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''));
}

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

  const { configured: hasSupabase } = supabaseConfig();
  const allowWebhookFallback = String(process.env.DEALCOMPASS_ALLOW_WEBHOOK_FALLBACK || '').trim() === '1';

  let storedIn = null;
  if (hasSupabase) {
    try {
      await supabaseInsert('signup_submissions', row);
      storedIn = 'supabase';
    } catch (e) {
      if (!allowWebhookFallback) {
        return json(res, 502, {
          ok: false,
          error: 'supabase_write_failed',
          detail: e.body || e.message || null,
        });
      }
    }
  }

  if (!storedIn) {
    const webhook = process.env.DEALCOMPASS_FORM_WEBHOOK_URL;
    if (!webhook) return json(res, 500, { ok: false, error: 'missing_storage_target' });

    const webhookToken = process.env.DEALCOMPASS_FORM_WEBHOOK_TOKEN || '';
    const sheetResp = await postJson(
      webhook,
      { action: 'signup', row, token: webhookToken || undefined }
    );

    if (!sheetResp.ok) {
      return json(res, 502, { ok: false, error: 'sheet_write_failed', detail: sheetResp.body || null });
    }
    storedIn = 'webhook';
  }

  // Newsletter + welcome automation via Loops.
  const loops = {
    contact_sync: { attempted: false },
    signup_event: { attempted: false },
    welcome_transactional: { attempted: false },
  };

  const loopsKey = String(process.env.LOOPS_API_KEY || '').trim();
  if (loopsKey) {
    const loopsHeaders = { Authorization: `Bearer ${loopsKey}` };
    const userGroup = campaignChannel
      ? `dealcompass:${campaignChannel}`
      : 'dealcompass:general';

    loops.contact_sync.attempted = true;
    try {
      const contactResp = await postJson(
        'https://app.loops.so/api/v1/contacts/update',
        cleanUndefined({
          email,
          firstName: firstName || undefined,
          source: 'dealcompass_native_form',
          userGroup,
          subscribed: true,

          campaign_id: campaignId || undefined,
          campaign_channel: campaignChannel || undefined,
          campaign_variant: campaignVariant || undefined,
          primary_interest: primaryInterest || undefined,
          primary_goal: primaryGoal || undefined,
          requested_categories: requestedCategories || undefined,
          update_frequency: updateFrequency || undefined,
          delivery_preference: deliveryPreference || undefined,
          biggest_pain: biggestPain || undefined,
        }),
        loopsHeaders
      );
      loops.contact_sync.ok = contactResp.ok;
      loops.contact_sync.status = contactResp.status;
    } catch (e) {
      loops.contact_sync.ok = false;
      loops.contact_sync.error = sanitize(e.message || 'loops_contact_sync_failed', 160);
    }

    const signupEventName = sanitize(process.env.LOOPS_SIGNUP_EVENT_NAME || 'dealcompass_signup', 80);
    if (signupEventName) {
      loops.signup_event.attempted = true;
      try {
        const eventResp = await postJson(
          'https://app.loops.so/api/v1/events/send',
          {
            email,
            eventName: signupEventName,
            eventProperties: cleanUndefined({
              submission_id: submissionId,
              submitted_at: submittedAt,
              campaign_id: campaignId || undefined,
              campaign_channel: campaignChannel || undefined,
              campaign_variant: campaignVariant || undefined,
              primary_interest: primaryInterest || undefined,
              primary_goal: primaryGoal || undefined,
              requested_categories: requestedCategories || undefined,
              update_frequency: updateFrequency || undefined,
              delivery_preference: deliveryPreference || undefined,
            }),
          },
          loopsHeaders
        );
        loops.signup_event.ok = eventResp.ok;
        loops.signup_event.status = eventResp.status;
      } catch (e) {
        loops.signup_event.ok = false;
        loops.signup_event.error = sanitize(e.message || 'loops_signup_event_failed', 160);
      }
    }

    const signupTransactionalId = sanitize(process.env.LOOPS_SIGNUP_WELCOME_TRANSACTIONAL_ID, 160);
    if (signupTransactionalId) {
      loops.welcome_transactional.attempted = true;
      const displayName = firstName || 'there';
      try {
        const transactionalResp = await postJson(
          'https://app.loops.so/api/v1/transactional',
          {
            email,
            transactionalId: signupTransactionalId,
            addToAudience: true,
            dataVariables: {
              firstName: displayName,
              primaryInterest: primaryInterest || 'tech',
              primaryGoal: primaryGoal || 'best_value',
              requestedCategories: requestedCategories || 'none',
              updateFrequency: updateFrequency || 'weekly_digest',
              manageUrl: 'https://dealcompass.app/signup.html',
              feedbackUrl: 'https://dealcompass.app/feedback.html',
            },
          },
          loopsHeaders
        );
        loops.welcome_transactional.ok = transactionalResp.ok;
        loops.welcome_transactional.status = transactionalResp.status;
      } catch (e) {
        loops.welcome_transactional.ok = false;
        loops.welcome_transactional.error = sanitize(e.message || 'loops_transactional_failed', 160);
      }
    }
  }

  return json(res, 200, {
    ok: true,
    submission_id: submissionId,
    storage: storedIn,
    loops,
  });
};
