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

    // Filter index to only dates that have actual deal data
    // Check up to 30 most recent - valid ones stay, empties get pruned from the exposed index
    const validIndex = [];
    for (const date of index) {
      const snap = await kvGet('snapshot:' + date);
      if (Array.isArray(snap) && snap.length > 0) {
        validIndex.push(date);
      }
    }

    if (validIndex.length === 0) {
      return res.status(200).json({ today: null, weekAgo: null, index: [] });
    }

    const { from, to } = req.query;

    // Find nearest valid snapshot on or before requested date
    const nearest = (requested, idx) => {
      if (!requested) return null;
      if (idx.includes(requested)) return requested;
      return idx.find(d => d <= requested) || idx[idx.length - 1];
    };

    const todayKey = nearest(to, validIndex) || validIndex[0];

    let weekAgoKey;
    if (from) {
      weekAgoKey = nearest(from, validIndex);
    } else {
      // Default: 7 days before todayKey, or oldest available
      const [ty, tm, td] = todayKey.split('-').map(Number);
      const weekAgoDate = new Date(ty, tm - 1, td - 7);
      const weekAgoStr = weekAgoDate.getFullYear() + '-' +
        String(weekAgoDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(weekAgoDate.getDate()).padStart(2, '0');
      weekAgoKey = nearest(weekAgoStr, validIndex) || validIndex[validIndex.length - 1];
    }

    const [todaySnap, weekAgoSnap] = await Promise.all([
      kvGet('snapshot:' + todayKey),
      kvGet('snapshot:' + weekAgoKey)
    ]);

    const ensureArray = v => Array.isArray(v) ? v : [];

    return res.status(200).json({
      today:   { date: todayKey,   deals: ensureArray(todaySnap)   },
      weekAgo: { date: weekAgoKey, deals: ensureArray(weekAgoSnap) },
      index: validIndex  // only return dates with real data
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
