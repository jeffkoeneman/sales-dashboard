export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV not configured' });
  }

  try {
    // Get index of available snapshots
    const indexRes = await fetch(kvUrl + '/get/snapshot:index', {
      headers: { Authorization: 'Bearer ' + kvToken }
    });
    const indexData = await indexRes.json();
    let index = [];
    try { index = JSON.parse(indexData.result || '[]'); } catch(e) {}

    if (index.length === 0) {
      return res.status(200).json({ today: null, weekAgo: null, index: [] });
    }

    // Get today's snapshot (most recent) and 7 days ago
    const todayKey = index[0];
    const todayDate = new Date(todayKey);
    const weekAgoDate = new Date(todayDate);
    weekAgoDate.setDate(weekAgoDate.getDate() - 7);
    const weekAgoStr = weekAgoDate.toISOString().slice(0, 10);

    // Find closest available snapshot to 7 days ago
    let weekAgoKey = index.find(d => d <= weekAgoStr) || index[index.length - 1];

    const [todayRes, weekAgoRes] = await Promise.all([
      fetch(kvUrl + '/get/snapshot:' + todayKey, { headers: { Authorization: 'Bearer ' + kvToken } }),
      fetch(kvUrl + '/get/snapshot:' + weekAgoKey, { headers: { Authorization: 'Bearer ' + kvToken } })
    ]);

    const [todayData, weekAgoData] = await Promise.all([todayRes.json(), weekAgoRes.json()]);

    let todaySnapshot = [], weekAgoSnapshot = [];
    try { todaySnapshot = JSON.parse(todayData.result || '[]'); } catch(e) {}
    try { weekAgoSnapshot = JSON.parse(weekAgoData.result || '[]'); } catch(e) {}

    return res.status(200).json({
      today: { date: todayKey, deals: todaySnapshot },
      weekAgo: { date: weekAgoKey, deals: weekAgoSnapshot },
      index
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
