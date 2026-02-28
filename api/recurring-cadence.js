const { json, sanitize, nowIso } = require('./_shared');
const { supabaseConfig } = require('./_supabase');

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
    return { perCategory: 1, maxTotal: 4, maxRank: 3 };
  }
  if (cadence === 'twice_weekly') {
    return { perCategory: 2, maxTotal: 6, maxRank: 99999 };
  }
  return { perCategory: 3, maxTotal: 8, maxRank: 99999 };
}

function roundRobinByCategory(picksByCategory, categories, perCategory, maxTotal, maxRank) {
  const queues = categories
    .map((cat) => {
      const list = (picksByCategory.get(cat) || []).filter((p) => Number(p.rank || 9999) <= maxRank);
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
    weekly_digest: String(process.env.LOOPS_RECURRING_TEMPLATE_WEEKLY || process.env.LOOPS_SIGNUP_WELCOME_TRANSACTIONAL_ID || '').trim(),
    twice_weekly: String(process.env.LOOPS_RECURRING_TEMPLATE_TWICE_WEEKLY || process.env.LOOPS_SIGNUP_WELCOME_TRANSACTIONAL_ID || '').trim(),
    high_signal_only: String(process.env.LOOPS_RECURRING_TEMPLATE_HIGH_SIGNAL || process.env.LOOPS_SIGNUP_WELCOME_TRANSACTIONAL_ID || '').trim(),
  };
  const transactionalId = templateIdMap[cadence];
  if (!transactionalId) {
    return json(res, 500, { ok: false, error: 'missing_transactional_template_for_cadence', cadence });
  }

  const dryRun = String(q.dry_run || '').trim() === '1';
  const coreCategories = String(process.env.CORE_CATEGORY_SLUGS || 'tech,home')
    .split(',')
    .map((x) => norm(x))
    .filter(Boolean);

  let submissions;
  let picks;
  try {
    submissions = await sbGet('signup_submissions?select=user_email,user_name,primary_interest,update_frequency,delivery_preference,submitted_at,consent&consent=eq.YES&order=submitted_at.desc&limit=5000');
    picks = await sbGet('affiliate_links_live?select=category,title,url,blurb,rank,generated_rank,active,created_at,updated_at&active=eq.true&order=category.asc,generated_rank.asc,rank.asc&limit=200');
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

  const cadenceSubscribers = [];
  for (const row of latestByEmail.values()) {
    const pref = cadenceFromInput(row.update_frequency);
    if (pref !== cadence) continue;
    const delivery = norm(row.delivery_preference);
    if (delivery && !delivery.includes('email')) continue;
    cadenceSubscribers.push({
      email: String(row.user_email || '').trim().toLowerCase(),
      firstName: sanitize(row.user_name || '', 80),
      interest: interestFromInput(row.primary_interest),
      subscribedAt: row.submitted_at || null,
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

  const sendResults = [];
  for (const sub of cadenceSubscribers) {
    let allowedCategories = [];
    if (sub.interest === 'all') {
      allowedCategories = allCategories;
    } else if (sub.interest === 'new_categories') {
      allowedCategories = newCategories;
    } else {
      allowedCategories = allCategories.includes(sub.interest) ? [sub.interest] : [];
    }

    const selected = roundRobinByCategory(
      picksByCategory,
      allowedCategories,
      limits.perCategory,
      limits.maxTotal,
      limits.maxRank
    );

    if (!selected.length) {
      sendResults.push({ email: sub.email, sent: false, reason: 'no_matching_picks', interest: sub.interest });
      continue;
    }

    const dataVariables = {
      firstName: sub.firstName || 'there',
      cadenceKey: cadence,
      primaryInterest: sub.interest,
      categoriesLine: allowedCategories.join(', '),
      currentPicksUrl: 'https://dealcompass.app/current-picks.html',
      reviewsUrl: 'https://dealcompass.app/reviews.html',
      feedbackUrl: 'https://dealcompass.app/feedback.html',
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
    sample: sendResults.slice(0, 25),
  });
};
