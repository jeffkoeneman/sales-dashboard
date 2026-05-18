export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const path = req.query.path || req.query.endpoint;
  if (!path) return res.status(400).json({ error: 'path param required' });

  const url = 'https://api.hubapi.com/' + path;
  const fetchOpts = {
    method: req.method === 'POST' ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  };

  if (req.method === 'POST' && req.body) {
    fetchOpts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const r = await fetch(url, fetchOpts);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
    return res.status(r.status).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
