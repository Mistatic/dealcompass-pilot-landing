function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 200_000) {
        reject(new Error('payload_too_large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function sanitize(value, max = 500) {
  const s = String(value ?? '').replace(/\0/g, '').replace(/[\r\n]+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function emailOk(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function asBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').toLowerCase().trim();
  return ['1', 'true', 'yes', 'y', 'on'].includes(s);
}

async function postJson(url, payload, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { ok: r.ok, status: r.status, body: parsed };
}

function nowIso() {
  return new Date().toISOString();
}

function makeSubmissionId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

module.exports = {
  json,
  readBody,
  sanitize,
  emailOk,
  asBool,
  postJson,
  nowIso,
  makeSubmissionId,
};
