// One-time: remove broken snapshot dates from index, keep only valid ones
export default async function handler(req, res) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const headers = { Authorization: 'Bearer ' + kvToken };

  const kvGet = async (key) => {
    const r = await fetch(kvUrl + '/get/' + encodeURIComponent(key), { headers });
    const d = await r.json();
    if (!d.result) return null;
    if (typeof d.result === 'string') { try { return JSON.parse(d.result); } catch(e) { return null; } }
    return d.result;
  };

  const index = await kvGet('snapshot:index') || [];
  const valid = [];
  const broken = [];

  for (const date of index) {
    const snap = await kvGet('snapshot:' + date);
    if (Array.isArray(snap) && snap.length > 0) {
      valid.push(date);
    } else {
      broken.push(date);
    }
  }

  // Write cleaned index
  await fetch(kvUrl + '/set/snapshot:index', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(valid)
  });

  return res.status(200).json({ valid, broken, validCount: valid.length, brokenRemoved: broken.length });
}
