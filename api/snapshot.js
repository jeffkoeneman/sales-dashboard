export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow GET from cron or POST from the dashboard button
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.HUBSPOT_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!token || !kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  try {
    // Fetch all pipelines to build stage maps
    const pipesRes = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const pipesData = await pipesRes.json();
    const pipelines = pipesData.results || [];

    // Build stageId -> probability map (0-100) and stageId -> label map
    const stageProbMap = {};
    const stageLabelMap = {};
    const wonStageIds = new Set();
    const lostStageIds = new Set();

    pipelines.forEach(p => {
      if (!p.stages) return;
      p.stages.forEach(s => {
        const prob = parseFloat(s.metadata && s.metadata.probability);
        if (!isNaN(prob)) stageProbMap[s.id] = prob * 100;
        stageLabelMap[s.id] = s.label;
        const closed = s.metadata && (s.metadata.isClosed === 'true' || s.metadata.isClosed === true);
        if (closed && prob === 1) wonStageIds.add(s.id);
        if (closed && prob === 0) lostStageIds.add(s.id);
        if (s.metadata && s.metadata.stageType === 'WON') wonStageIds.add(s.id);
        if (s.metadata && s.metadata.stageType === 'LOST') lostStageIds.add(s.id);
      });
    });

    // Fetch all deals
    const props = [
      'dealname', 'amount', 'dealstage', 'closedate', 'createdate',
      'hubspot_owner_id', 'pipeline', 'hs_closed_won_date',
      'agent_firm_type', 'agent_use_case', 'company'
    ].join(',');

    let deals = [], after;
    do {
      const url = 'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=' + props + (after ? '&after=' + after : '');
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const d = await r.json();
      deals = deals.concat(d.results || []);
      after = d.paging?.next?.after;
    } while (after);

    // Fetch owners
    const ownersRes = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const ownersData = await ownersRes.json();
    const ownerMap = {};
    (ownersData.results || []).forEach(o => {
      ownerMap[o.id] = (o.firstName || '') + (o.lastName ? ' ' + o.lastName : '') || o.email || o.id;
    });

    // Build snapshot — one record per open deal
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const snapshot = deals
      .filter(d => !wonStageIds.has(d.properties.dealstage) && !lostStageIds.has(d.properties.dealstage))
      .map(d => {
        const amount = parseFloat(d.properties.amount || 0);
        const prob = stageProbMap[d.properties.dealstage] || 0;
        return {
          id: d.id,
          name: d.properties.dealname || '',
          amount,
          stage: d.properties.dealstage,
          stageLabel: stageLabelMap[d.properties.dealstage] || d.properties.dealstage,
          prob,
          los: amount * prob / 100,
          pipeline: d.properties.pipeline,
          owner: ownerMap[d.properties.hubspot_owner_id] || 'Unassigned',
          ownerId: d.properties.hubspot_owner_id || '',
          firmType: d.properties.agent_firm_type || '',
          useCase: d.properties.agent_use_case || '',
          closeDate: d.properties.closedate || '',
          company: d.properties.company || ''
        };
      });

    // Write to KV — key format: snapshot:YYYY-MM-DD
    const key = 'snapshot:' + today;
    const kvRes = await fetch(kvUrl + '/set/' + key, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + kvToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(snapshot) })
    });

    if (!kvRes.ok) {
      throw new Error('KV write failed: ' + await kvRes.text());
    }

    // Also write an index of available snapshot dates
    const indexRes = await fetch(kvUrl + '/get/snapshot:index', {
      headers: { Authorization: 'Bearer ' + kvToken }
    });
    const indexData = await indexRes.json();
    let index = [];
    try { index = JSON.parse(indexData.result || '[]'); } catch(e) {}
    if (!index.includes(today)) {
      index.push(today);
      index.sort().reverse(); // newest first, keep last 90 days
      index = index.slice(0, 90);
      await fetch(kvUrl + '/set/snapshot:index', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(index) })
      });
    }

    return res.status(200).json({
      success: true,
      date: today,
      dealsSnapshotted: snapshot.length,
      totalDeals: deals.length
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
