// One-time migration: read old {value: "..."} format snapshots and re-save correctly
export default async function handler(req, res) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const headers = { Authorization: 'Bearer ' + kvToken };

  const kvRaw = async (key) => {
    const r = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, { headers });
    const d = await r.json();
    return d.result; // return raw string, don't parse
  };

  const kvSet = async (key, value) => {
    const r = await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    return r.ok;
  };

  // All dates from Apr 12 to May 17
  const dates = [];
  const start = new Date('2026-04-12');
  const end = new Date('2026-05-17');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const results = [];

  for (const date of dates) {
    const raw = await kvRaw('snapshot:' + date);
    if (!raw) { results.push({ date, status: 'missing' }); continue; }

    let deals = null;

    // Try direct parse first
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        results.push({ date, status: 'already_valid', count: parsed.length });
        continue;
      }
      // Try {value: "..."} wrapper format
      if (parsed && typeof parsed.value === 'string') {
        const inner = JSON.parse(parsed.value);
        if (Array.isArray(inner) && inner.length > 0) {
          deals = inner;
        }
      }
      // Try {value: [...]} wrapper
      if (parsed && Array.isArray(parsed.value)) {
        deals = parsed.value;
      }
    } catch(e) {
      // raw might itself be the value string
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) deals = parsed;
      } catch(e2) {}
    }

    if (deals && deals.length > 0) {
      // Re-save in correct format (raw JSON array string)
      await kvSet('snapshot:' + date, JSON.stringify(deals));
      results.push({ date, status: 'migrated', count: deals.length });
    } else {
      results.push({ date, status: 'unrecoverable', rawType: typeof raw, rawSnippet: String(raw).slice(0, 100) });
    }
  }

  // Rebuild index with all valid dates
  const validDates = results
    .filter(r => r.status === 'migrated' || r.status === 'already_valid')
    .map(r => r.date)
    .sort().reverse();

  // Add existing valid dates (May 18, 19)
  const existingIndex = ['2026-05-19', '2026-05-18'];
  const fullIndex = [...new Set([...existingIndex, ...validDates])].sort().reverse();

  await kvSet('snapshot:index', JSON.stringify(fullIndex));

  return res.status(200).json({ results, fullIndex });
}
