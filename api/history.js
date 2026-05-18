export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV not configured' });
  }

  const kvGet = async (key) => {
    const r = await fetch(kvUrl + '/get/' + encodeURIComponent(key), {
      headers: { Authorization: 'Bearer ' + kvToken }
    });
    const d = await r.json();
    try { return JSON.parse(d.result || 'null'); } catch(e) { return null; }
  };

  try {
    // Get index of available snapshots
    let index = await kvGet('snapshot:index');
    if (!Array.isArray(index) || index.length === 0) {
      return res.status(200).json({ today: null, weekAgo: null, index: [] });
    }

    // Support custom from/to date range via query params
    const { from, to } = req.query;

    let todayKey, weekAgoKey;

    if (to && index.includes(to)) {
      todayKey = to;
    } else {
      todayKey = index[0]; // most recent
    }

    if (from && index.includes(from)) {
      weekAgoKey = from;
    } else {
      // Default: find snapshot closest to 7 days before todayKey
      const [ty, tm, td] = todayKey.split('-').map(Number);
      const weekAgoDate = new Date(ty, tm - 1, td - 7);
      const weekAgoStr = weekAgoDate.getFullYear() + '-' +
        String(weekAgoDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(weekAgoDate.getDate()).padStart(2, '0');
      weekAgoKey = index.find(d => d <= weekAgoStr) || index[index.length - 1];
    }

    const [todaySnap, weekAgoSnap] = await Promise.all([
      kvGet('snapshot:' + todayKey),
      kvGet('snapshot:' + weekAgoKey)
    ]);

    return res.status(200).json({
      today:   { date: todayKey,   deals: todaySnap   || [] },
      weekAgo: { date: weekAgoKey, deals: weekAgoSnap || [] },
      index
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
