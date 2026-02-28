const crypto = require('crypto');
const { json, sanitize, nowIso } = require('./_shared');
const { supabaseConfig } = require('./_supabase');
const { buildPreferencesUrl } = require('./_preferences');

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function parseQuery(req) {
  try {
    const u = new URL(req.url || '', 'http://localhost');
    return Object.fromEntries(u.searchParams.entries());
  } catch {
    return {};
  }
}

function cadenceFromInput(v) {
  const k = norm(v);
  if (k === 'weekly' || k === 'weekly_digest') return 'weekly_digest';
  if (k === 'twice' || k === 'twice_weekly') return 'twice_weekly';
  if (k === 'high' || k === 'high_signal' || k === 'high_signal_only') return 'high_signal_only';
  return '';
}

function interestFromInput(v) {
  const k = norm(v);
  if (k === 'both') return 'all';
  if (k === 'all' || k === 'new_categories' || k === 'tech' || k === 'home') return k;
  return k || 'all';
}

function pickLimitsForCadence(cadence) {
  if (cadence === 'high_signal_only') {
    return { perCategory: 1, maxTotal: 4, maxRank: 2 };
  }
  if (cadence === 'twice_weekly') {
    return { perCategory: 2, maxTotal: 6, maxRank: 99999 };
  }
  return { perCategory: 3, maxTotal: 8, maxRank: 99999 };
}

function parseIsoMs(v) {
  const t = Date.parse(String(v || ''));
  return Number.isFinite(t) ? t : null;
}

function cadenceFilter(picks, cadence, maxRank) {
  const maxAgeHours = Number(process.env.HIGH_SIGNAL_MAX_AGE_HOURS || 72);
  const now = Date.now();
  return (picks || []).filter((p) => {
    const rankOk = Number(p.rank || 9999) <= maxRank;
    if (!rankOk) return false;
    if (cadence !== 'high_signal_only') return true;
    const t = parseIsoMs(p.updatedAt);
    if (t == null) return false;
    const ageHours = (now - t) / 36e5;
    return ageHours >= 0 && ageHours <= maxAgeHours;
  });
}

function roundRobinByCategory(picksByCategory, categories, perCategory, maxTotal, maxRank, cadence) {
  const queues = categories
    .map((cat) => {
      const list = cadenceFilter(picksByCategory.get(cat) || [], cadence, maxRank);
      return { cat, list: list.slice(0, perCategory), i: 0 };
    })
    .filter((q) => q.list.length > 0);

  const out = [];
  let safety = 0;
  while (out.length < maxTotal && queues.some((q) => q.i < q.list.length) && safety < 500) {
    for (const q of queues) {
      if (out.length >= maxTotal) break;
      if (q.i < q.list.length) {
        out.push(q.list[q.i]);
        q.i += 1;
      }
    }
    safety += 1;
  }
  return out;
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

async function sbInsert(table, row) {
  const { url, key, configured } = supabaseConfig();
  if (!configured) throw new Error('supabase_not_configured');
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
    const err = new Error('supabase_insert_failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
}

async function loopsTransactionalSend(apiKey, payload) {
  const res = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
  return { ok: res.ok, status: res.status, body };
}

async function postRunAlert(payload) {
  const url = String(process.env.RECURRING_ALERT_WEBHOOK_URL || '').trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (_) {}
}

function isoHoursAgo(hours) {
  const ms = Number(hours || 0) * 36e5;
  return new Date(Date.now() - ms).toISOString();
}

function hashPickSet(cadence, picks) {
  const material = `${cadence}|${(picks || []).map((p) => `${p.category}:${p.title}:${p.url}`).join('|')}`;
  return crypto.createHash('sha1').update(material).digest('hex');
}

module.exports = async (req, res) => {
  if (!['GET', 'POST'].includes(req.method || 'GET')) {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const q = parseQuery(req);
  const cadence = cadenceFromInput(q.cadence || req.headers['x-dc-cadence']);
  if (!cadence) {
    return json(res, 400, { ok: false, error: 'missing_or_invalid_cadence' });
  }

  const secret = String(process.env.RECURRING_CADENCE_SECRET || '').trim();
  const authHeader = String(req.headers.authorization || '').trim();
  const token = String(q.token || '').trim();
  const hasCronHeader = Boolean(req.headers['x-vercel-cron']);
  if (secret && !hasCronHeader) {
    const ok = authHeader === `Bearer ${secret}` || token === secret;
    if (!ok) return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  const loopsKey = String(process.env.LOOPS_API_KEY || '').trim();
  if (!loopsKey) return json(res, 500, { ok: false, error: 'missing_loops_api_key' });

  const templateIdMap = {
    weekly_digest: String(process.env.LOOPS_RECURRING_TEMPLATE_WEEKLY || '').trim(),
    twice_weekly: String(process.env.LOOPS_RECURRING_TEMPLATE_TWICE_WEEKLY || '').trim(),
    high_signal_only: String(process.env.LOOPS_RECURRING_TEMPLATE_HIGH_SIGNAL || '').trim(),
  };
  const transactionalId = templateIdMap[cadence];
  if (!transactionalId) {
    return json(res, 500, { ok: false, error: 'missing_transactional_template_for_cadence', cadence });
  }

  const dryRun = String(q.dry_run || '').trim() === '1';
  const targetEmail = norm(q.email || q.test_email || '');
  const forceTarget = String(q.force_target || '').trim() === '1';
  const coreCategories = String(process.env.CORE_CATEGORY_SLUGS || 'tech,home')
    .split(',')
    .map((x) => norm(x))
    .filter(Boolean);

  let submissions;
  let picks;
  let prefRows = [];
  try {
    submissions = await sbGet('signup_submissions?select=user_email,user_name,primary_interest,update_frequency,delivery_preference,submitted_at,consent&consent=eq.YES&order=submitted_at.desc&limit=5000');
    picks = await sbGet('affiliate_links_live?select=category,title,url,blurb,rank,generated_rank,active,created_at,updated_at&active=eq.true&order=category.asc,generated_rank.asc,rank.asc&limit=200');
    try {
      prefRows = await sbGet('user_preferences?select=email,first_name,primary_interest,update_frequency,delivery_preference,status,updated_at&order=updated_at.desc&limit=5000');
    } catch (_) {
      prefRows = [];
    }
  } catch (e) {
    return json(res, 502, {
      ok: false,
      error: e.message || 'data_load_failed',
      status: e.status || null,
      detail: e.body || null,
    });
  }

  const latestByEmail = new Map();
  for (const row of submissions) {
    const email = String(row.user_email || '').trim().toLowerCase();
    if (!email || latestByEmail.has(email)) continue;
    latestByEmail.set(email, row);
  }

  const prefByEmail = new Map();
  for (const p of prefRows) {
    const email = String(p.email || '').trim().toLowerCase();
    if (!email || prefByEmail.has(email)) continue;
    prefByEmail.set(email, p);
  }

  const cadenceSubscribers = [];
  for (const row of latestByEmail.values()) {
    const email = String(row.user_email || '').trim().toLowerCase();
    if (targetEmail && email !== targetEmail) continue;

    const prefRow = prefByEmail.get(email);

    const sourceCadence = prefRow?.update_frequency || row.update_frequency;
    const pref = cadenceFromInput(sourceCadence);
    if (!forceTarget && pref !== cadence) continue;

    const deliveryRaw = prefRow?.delivery_preference || row.delivery_preference;
    const delivery = norm(deliveryRaw);
    if (delivery && !delivery.includes('email')) continue;

    const status = norm(prefRow?.status || 'active');
    if (status && status !== 'active') continue;

    cadenceSubscribers.push({
      email,
      firstName: sanitize(prefRow?.first_name || row.user_name || '', 80),
      interest: interestFromInput(prefRow?.primary_interest || row.primary_interest),
      subscribedAt: prefRow?.updated_at || row.submitted_at || null,
      managePreferencesUrl: buildPreferencesUrl(email),
    });
  }

  const picksByCategory = new Map();
  for (const p of picks) {
    const category = norm(p.category);
    if (!category) continue;
    const list = picksByCategory.get(category) || [];
    const rawRank = p.rank ?? p.generated_rank;
    const numericRank = Number(rawRank);
    list.push({
      category,
      title: sanitize(p.title || 'Deal pick', 180),
      url: sanitize(p.url || 'https://dealcompass.app/current-picks.html', 500),
      blurb: sanitize(p.blurb || '', 280),
      rank: Number.isFinite(numericRank) && numericRank > 0 ? numericRank : (list.length + 1),
      updatedAt: p.updated_at || p.created_at || null,
    });
    picksByCategory.set(category, list);
  }

  const allCategories = Array.from(picksByCategory.keys());
  const newCategories = allCategories.filter((c) => !coreCategories.includes(c));
  const limits = pickLimitsForCadence(cadence);
  const dedupeWindowHours = Number(process.env.RECURRING_DEDUPE_WINDOW_HOURS || 20);
  const dedupeSinceIso = isoHoursAgo(dedupeWindowHours);

  const sendResults = [];
  const diagnostics = {
    picks_per_category: Object.fromEntries(Array.from(picksByCategory.entries()).map(([k, v]) => [k, v.length])),
    high_signal_max_age_hours: Number(process.env.HIGH_SIGNAL_MAX_AGE_HOURS || 72),
    dedupe_window_hours: dedupeWindowHours,
    preferences_rows_loaded: prefRows.length,
  };
  for (const sub of cadenceSubscribers) {
    let allowedCategories = [];
    if (sub.interest === 'all') {
      allowedCategories = allCategories;
    } else if (sub.interest === 'new_categories') {
      allowedCategories = newCategories;
    } else {
      allowedCategories = allCategories.includes(sub.interest) ? [sub.interest] : [];
    }

    // Idempotency guard: skip if recently sent for same cadence/email
    if (!dryRun && dedupeWindowHours > 0) {
      try {
        const recent = await sbGet(
          `recurring_email_log?select=email,cadence,sent_at&email=eq.${encodeURIComponent(sub.email)}&cadence=eq.${encodeURIComponent(cadence)}&sent_at=gte.${encodeURIComponent(dedupeSinceIso)}&order=sent_at.desc&limit=1`
        );
        if (recent.length > 0) {
          sendResults.push({
            email: sub.email,
            sent: false,
            reason: 'recent_send_guard',
            interest: sub.interest,
            allowed_categories: allowedCategories,
          });
          continue;
        }
      } catch (_) {
        // Optional table; do not fail campaign run if log table isn't present.
      }
    }

    const selected = roundRobinByCategory(
      picksByCategory,
      allowedCategories,
      limits.perCategory,
      limits.maxTotal,
      limits.maxRank,
      cadence
    );

    if (!selected.length) {
      sendResults.push({
        email: sub.email,
        sent: false,
        reason: 'no_matching_picks',
        interest: sub.interest,
        allowed_categories: allowedCategories,
      });
      continue;
    }

    const cadenceCopy = {
      weekly_digest: {
        email_subject: 'Your weekly DealCompass picks',
        cadence_label: 'Weekly Digest',
        intro_line: 'A weekly summary of the best category-matched picks.',
      },
      twice_weekly: {
        email_subject: 'DealCompass mid-week and weekend picks',
        cadence_label: 'Twice Weekly',
        intro_line: 'Two focused updates each week with fresh picks.',
      },
      high_signal_only: {
        email_subject: 'High-signal DealCompass alert',
        cadence_label: 'High Signal Only',
        intro_line: 'Only top-ranked, recently-updated opportunities.',
      },
    }[cadence];

    const dataVariables = {
      firstName: sub.firstName || 'there',
      cadenceKey: cadence,
      cadence_label: cadenceCopy.cadence_label,
      email_subject: cadenceCopy.email_subject,
      intro_line: cadenceCopy.intro_line,
      primaryInterest: sub.interest,
      categoriesLine: allowedCategories.join(', '),
      currentPicksUrl: 'https://dealcompass.app/current-picks.html',
      reviewsUrl: 'https://dealcompass.app/reviews.html',
      feedbackUrl: 'https://dealcompass.app/feedback.html',
      manage_preferences_url: sub.managePreferencesUrl,
      manageUrl: sub.managePreferencesUrl,
      sentAt: nowIso(),
      pick_count: selected.length,
    };

    selected.forEach((p, idx) => {
      const n = idx + 1;
      dataVariables[`pick${n}_category`] = p.category;
      dataVariables[`pick${n}_title`] = p.title;
      dataVariables[`pick${n}_url`] = p.url;
      dataVariables[`pick${n}_blurb`] = p.blurb;
      dataVariables[`pick${n}_rank`] = String(p.rank || '');
    });

    if (dryRun) {
      sendResults.push({ email: sub.email, sent: true, dry_run: true, picks: selected.length, interest: sub.interest });
      continue;
    }

    const resp = await loopsTransactionalSend(loopsKey, {
      transactionalId,
      email: sub.email,
      dataVariables,
    });

    if (resp.ok) {
      try {
        await sbInsert('recurring_email_log', {
          email: sub.email,
          cadence,
          sent_at: nowIso(),
          picks_count: selected.length,
          interest: sub.interest,
          pick_hash: hashPickSet(cadence, selected),
        });
      } catch (_) {
        // Optional table; non-blocking
      }
    }

    sendResults.push({
      email: sub.email,
      sent: resp.ok,
      status: resp.status,
      interest: sub.interest,
      picks: selected.length,
    });
  }

  const sent = sendResults.filter((r) => r.sent).length;
  const failed = sendResults.filter((r) => !r.sent).length;

  if (!dryRun) {
    await postRunAlert({
      service: 'dealcompass-recurring-cadence',
      cadence,
      sent,
      failed,
      subscribers_considered: cadenceSubscribers.length,
      timestamp: nowIso(),
      sample_failures: sendResults.filter((r) => !r.sent).slice(0, 5),
    });
  }

  return json(res, 200, {
    ok: true,
    cadence,
    dry_run: dryRun,
    totals: {
      subscribers_considered: cadenceSubscribers.length,
      sent,
      failed,
      active_categories: allCategories,
      new_categories: newCategories,
    },
    diagnostics,
    sample: sendResults.slice(0, 25),
  });
};
