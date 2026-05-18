export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const kvGet = async (key) => {
    const r = await fetch(kvUrl + '/get/' + encodeURIComponent(key), {
      headers: { Authorization: 'Bearer ' + kvToken }
    });
    const d = await r.json();
    if (!d.result) return null;
    // Result may be a JSON string or already parsed - handle both
    if (typeof d.result === 'string') {
      try { return JSON.parse(d.result); } catch(e) { return null; }
    }
    return d.result;
  };

  try {
    let index = await kvGet('snapshot:index');
    if (!Array.isArray(index) || index.length === 0) {
      return res.status(200).json({ today: null, weekAgo: null, index: [] });
    }

    const { from, to } = req.query;

    let todayKey = (to && index.includes(to)) ? to : index[0];
    let weekAgoKey;
    if (from && index.includes(from)) {
      weekAgoKey = from;
    } else {
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

    // Ensure deals are always arrays
    const ensureArray = v => Array.isArray(v) ? v : [];

    return res.status(200).json({
      today:   { date: todayKey,   deals: ensureArray(todaySnap)   },
      weekAgo: { date: weekAgoKey, deals: ensureArray(weekAgoSnap) },
      index
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
