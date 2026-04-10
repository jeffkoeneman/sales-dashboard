export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'Missing path param' });

  try {
    const url = 'https://api.hubapi.com' + path;
    const hsRes = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    const data = await hsRes.json();
    res.status(hsRes.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
