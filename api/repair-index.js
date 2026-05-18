// One-time repair: rebuild snapshot:index from all existing snapshot:YYYY-MM-DD keys
// Deploy to api/repair-index.js, hit once, then delete
export default async function handler(req, res) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const headers = { Authorization: 'Bearer ' + kvToken };

  // Scan all keys matching snapshot:20*
  const scanRes = await fetch(kvUrl + '/scan/0?match=snapshot:20*&count=200', { headers });
  const scanData = await scanRes.json();
  // scanData.result = [cursor, [keys...]]
  const keys = (scanData.result?.[1] || [])
    .filter(k => /^snapshot:\d{4}-\d{2}-\d{2}$/.test(k))
    .map(k => k.replace('snapshot:', ''))
    .sort()
    .reverse();

  // Write the rebuilt index
  const setRes = await fetch(kvUrl + '/set/snapshot:index', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(keys)
  });

  return res.status(200).json({ rebuilt: keys, count: keys.length, setOk: setRes.ok });
}
