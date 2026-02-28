const { json, readBody, sanitize, postJson, nowIso, makeSubmissionId } = require('./_shared');
const { supabaseConfig, supabaseInsert, supabaseUpsert } = require('./_supabase');
const {
  verifyPreferencesToken,
  buildPreferencesUrl,
  normalizePreferencePayload,
} = require('./_preferences');

function parseQuery(req) {
  try {
    const u = new URL(req.url || '', 'http://localhost');
    return Object.fromEntries(u.searchParams.entries());
  } catch {
    return {};
  }
}

async function sbGet(path) {
  const { url, key, configured } = supabaseConfig();
  if (!configured) throw new Error('supabase_not_configured');
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
  if (!res.ok) {
    const err = new Error('supabase_query_failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return Array.isArray(body) ? body : [];
}

module.exports = async (req, res) => {
  const method = req.method || 'GET';
  if (!['GET', 'POST'].includes(method)) return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const q = parseQuery(req);
  const token = sanitize(q.t || q.token || '', 1200);
  const emailFromToken = verifyPreferencesToken(token);
  if (!emailFromToken) return json(res, 401, { ok: false, error: 'invalid_or_expired_token' });

  if (method === 'GET') {
    try {
      let pref = [];
      try {
        pref = await sbGet(`user_preferences?select=email,primary_interest,update_frequency,delivery_preference,status,updated_at&email=eq.${encodeURIComponent(emailFromToken)}&limit=1`);
      } catch (e) {
        // Some environments may not have this table yet; degrade gracefully.
        const missingTable = e?.body?.code === 'PGRST205';
        if (!missingTable) throw e;
      }

      if (pref.length > 0) {
        return json(res, 200, {
          ok: true,
          email: emailFromToken,
          preferences: pref[0],
          manage_preferences_url: buildPreferencesUrl(emailFromToken),
        });
      }

      let fallback = [];
      try {
        fallback = await sbGet(`signup_submissions?select=user_email,primary_interest,update_frequency,delivery_preference,submitted_at&user_email=eq.${encodeURIComponent(emailFromToken)}&order=submitted_at.desc&limit=1`);
      } catch (e) {
        const missingTable = e?.body?.code === 'PGRST205';
        if (!missingTable) throw e;
      }

      const row = fallback[0] || {};
      return json(res, 200, {
        ok: true,
        email: emailFromToken,
        preferences: {
          email: emailFromToken,
          primary_interest: row.primary_interest || 'all',
          update_frequency: row.update_frequency || 'weekly_digest',
          delivery_preference: row.delivery_preference || 'email',
          status: 'active',
          updated_at: row.submitted_at || null,
        },
        manage_preferences_url: buildPreferencesUrl(emailFromToken),
      });
    } catch (e) {
      return json(res, 502, { ok: false, error: 'preferences_load_failed', detail: e.body || e.message || null });
    }
  }

  // POST update
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message || 'bad_request' });
  }

  const patch = normalizePreferencePayload(body || {});
  if (!Object.keys(patch).length) return json(res, 400, { ok: false, error: 'no_valid_fields' });

  const row = {
    email: emailFromToken,
    ...patch,
    updated_at: nowIso(),
  };

  let storedIn = 'user_preferences';
  try {
    await supabaseUpsert('user_preferences', row, 'email');
  } catch (e) {
    const missingTable = e?.body?.code === 'PGRST205';
    if (!missingTable) {
      return json(res, 502, { ok: false, error: 'preferences_update_failed', detail: e.body || e.message || null });
    }

    // Fallback for environments where user_preferences isn't provisioned yet.
    // Persist latest preference-like fields into signup_submissions so reads
    // and cadence fallbacks remain functional.
    const submittedAt = nowIso();
    const fallbackRow = {
      submission_id: makeSubmissionId('prefs'),
      submitted_at: submittedAt,
      form_type: 'preferences_update',
      user_email: emailFromToken,
      user_name: null,
      primary_interest: patch.primary_interest || null,
      update_frequency: patch.update_frequency || null,
      delivery_preference: patch.delivery_preference || null,
      consent: 'YES',
      source: 'dealcompass_preferences_center',
    };

    try {
      await supabaseInsert('signup_submissions', fallbackRow);
      storedIn = 'signup_submissions';
    } catch (e2) {
      return json(res, 502, { ok: false, error: 'preferences_update_failed', detail: e2.body || e2.message || null });
    }
  }

  const loopsKey = String(process.env.LOOPS_API_KEY || '').trim();
  const loopsHeaders = loopsKey ? { Authorization: `Bearer ${loopsKey}` } : null;
  if (loopsHeaders) {
    try {
      await postJson(
        'https://app.loops.so/api/v1/contacts/update',
        {
          email: emailFromToken,
          primary_interest: patch.primary_interest,
          update_frequency: patch.update_frequency,
          delivery_preference: patch.delivery_preference,
          preference_status: patch.status,
          subscribed: patch.status === 'unsubscribed' ? false : true,
          manage_preferences_url: buildPreferencesUrl(emailFromToken),
        },
        loopsHeaders
      );
    } catch (_) {}
  }

  return json(res, 200, {
    ok: true,
    email: emailFromToken,
    stored_in: storedIn,
    preferences: { email: emailFromToken, ...patch },
    manage_preferences_url: buildPreferencesUrl(emailFromToken),
  });
};
