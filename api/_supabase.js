function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key, configured: Boolean(url && key) };
}

async function supabaseInsert(table, row) {
  const { url, key, configured } = supabaseConfig();
  if (!configured) {
    const err = new Error('supabase_not_configured');
    err.code = 'supabase_not_configured';
    throw err;
  }

  const endpoint = `${url}/rest/v1/${encodeURIComponent(table)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text || null; }

  if (!res.ok) {
    const err = new Error('supabase_insert_failed');
    err.code = 'supabase_insert_failed';
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

async function supabaseUpsert(table, row, onConflict = 'email') {
  const { url, key, configured } = supabaseConfig();
  if (!configured) {
    const err = new Error('supabase_not_configured');
    err.code = 'supabase_not_configured';
    throw err;
  }

  const endpoint = `${url}/rest/v1/${encodeURIComponent(table)}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  });

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text || null; }

  if (!res.ok) {
    const err = new Error('supabase_upsert_failed');
    err.code = 'supabase_upsert_failed';
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

module.exports = { supabaseConfig, supabaseInsert, supabaseUpsert };
