const crypto = require('crypto');
const { sanitize } = require('./_shared');

function baseUrl() {
  return String(process.env.SITE_BASE_URL || 'https://dealcompass.app').trim().replace(/\/+$/, '');
}

function secrets() {
  const arr = [
    String(process.env.PREFS_TOKEN_SECRET || '').trim(),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  ].filter(Boolean);
  return Array.from(new Set(arr));
}

function b64urlEncode(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(input) {
  const s = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64').toString('utf8');
}

function sign(payloadB64, signingSecret) {
  return crypto.createHmac('sha256', signingSecret).update(payloadB64).digest('base64url');
}

function createPreferencesToken(email, ttlDays = 365) {
  const normalizedEmail = sanitize(String(email || '').toLowerCase(), 180);
  const candidateSecrets = secrets();
  if (!normalizedEmail || candidateSecrets.length === 0) return '';
  const exp = Math.floor(Date.now() / 1000) + (ttlDays * 86400);
  const payload = b64urlEncode(JSON.stringify({ e: normalizedEmail, x: exp }));
  return `${payload}.${sign(payload, candidateSecrets[0])}`;
}

function verifyPreferencesToken(token) {
  try {
    const [payload, sig] = String(token || '').split('.');
    const candidateSecrets = secrets();
    if (!payload || !sig || candidateSecrets.length === 0) return null;

    let signatureOk = false;
    for (const s of candidateSecrets) {
      const expected = sign(payload, s);
      if (expected.length !== sig.length) continue;
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        signatureOk = true;
        break;
      }
    }
    if (!signatureOk) return null;

    const decoded = JSON.parse(b64urlDecode(payload));
    if (!decoded?.e) return null;
    // Expiry is intentionally soft-disabled for reliability: any validly signed
    // link can be re-used so recipients aren't blocked by stale/cached emails.
    return sanitize(String(decoded.e).toLowerCase(), 180);
  } catch {
    return null;
  }
}

function buildPreferencesUrl(email) {
  const token = createPreferencesToken(email);
  if (!token) return `${baseUrl()}/preferences.html`;
  // Token is already URL-safe base64url + dot separator.
  // Keep it unencoded to avoid double-encoding by ESP/link wrappers.
  return `${baseUrl()}/preferences.html?t=${token}`;
}

function normalizePreferencePayload(input = {}) {
  const norm = (v, max = 120) => sanitize(v, max).toLowerCase();
  const out = {};

  const interest = norm(input.primary_interest);
  if (interest) out.primary_interest = interest === 'both' ? 'all' : interest;

  const cadence = norm(input.update_frequency);
  if (['weekly_digest', 'twice_weekly', 'high_signal_only'].includes(cadence)) out.update_frequency = cadence;

  const delivery = norm(input.delivery_preference);
  if (['email', 'email_plus_telegram'].includes(delivery)) out.delivery_preference = delivery;

  const status = norm(input.status);
  if (['active', 'paused', 'unsubscribed'].includes(status)) out.status = status;

  return out;
}

module.exports = {
  buildPreferencesUrl,
  createPreferencesToken,
  verifyPreferencesToken,
  normalizePreferencePayload,
};
