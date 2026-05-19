export default async function handler(req, res) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const headers = { Authorization: 'Bearer ' + kvToken };

  // Scan ALL keys matching snapshot:YYYY-MM-DD
  let cursor = 0;
  const allKeys = [];
  do {
    const r = await fetch(`${kvUrl}/scan/${cursor}?match=snapshot:2*&count=200`, { headers });
    const d = await r.json();
    cursor = d.result?.[0] || 0;
    const keys = (d.result?.[1] || []).filter(k => /^snapshot:\d{4}-\d{2}-\d{2}$/.test(k));
    allKeys.push(...keys);
  } while (cursor !== 0 && cursor !== '0');

  // Check each one for valid data
  const valid = [];
  const broken = [];
  for (const key of allKeys) {
    const r = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, { headers });
    const d = await r.json();
    let parsed = null;
    try { parsed = JSON.parse(d.result); } catch(e) {}
    const date = key.replace('snapshot:', '');
    if (Array.isArray(parsed) && parsed.length > 0) {
      valid.push(date);
    } else {
      broken.push(date);
    }
  }

  valid.sort().reverse();

  // Write rebuilt index with only valid dates
  await fetch(`${kvUrl}/set/snapshot:index`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(valid)
  });

  return res.status(200).json({ valid, broken, validCount: valid.length, brokenCount: broken.length });
}
