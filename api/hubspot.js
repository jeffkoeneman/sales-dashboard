export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const path = req.query.path || req.query.endpoint;
  if (!path) return res.status(400).json({ error: 'path param required' });

  // Strip leading slash, build full HubSpot URL
  const cleanPath = path.replace(/^\/+/, '');
  const url = 'https://api.hubapi.com/' + cleanPath;

  // Log for debugging (visible in Vercel function logs)
  console.log('[hubspot proxy] url:', url);

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    const text = await r.text();

    // If not OK, return the status AND the URL so we can debug
    if (!r.ok) {
      return res.status(r.status).json({ error: 'HubSpot returned '+r.status, url, body: text.slice(0,300) });
    }

    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message, url });
  }
}
