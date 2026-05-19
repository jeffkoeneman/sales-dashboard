export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = process.env.HUBSPOT_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!token || !kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  // Upstash REST helpers
  const kvGet = async (key) => {
    const r = await fetch(kvUrl + '/get/' + encodeURIComponent(key), {
      headers: { Authorization: 'Bearer ' + kvToken }
    });
    const d = await r.json();
    try { return JSON.parse(d.result); } catch(e) { return null; }
  };
  const kvSet = async (key, value) => {
    // Upstash REST: POST /set/key with body = ["SET","key","value"]
    // Simplest: use the pipeline endpoint or just POST to /set/key with raw string body
    const r = await fetch(kvUrl + '/set/' + encodeURIComponent(key), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + kvToken,
        'Content-Type': 'application/json'
      },
      body: value  // value is already a JSON string; Upstash stores it as-is
    });
    if (!r.ok) throw new Error('KV write failed: ' + await r.text());
    return r.json();
  };

  try {
    // Fetch all pipelines
    const pipesRes = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const pipesData = await pipesRes.json();
    const pipelines = pipesData.results || [];
    const stageProbMap = {}, stageLabelMap = {};
    const wonStageIds = new Set(), lostStageIds = new Set();
    pipelines.forEach(p => {
      (p.stages || []).forEach(s => {
        const prob = parseFloat(s.metadata?.probability);
        if (!isNaN(prob)) stageProbMap[s.id] = prob * 100;
        stageLabelMap[s.id] = s.label;
        const closed = s.metadata?.isClosed === 'true' || s.metadata?.isClosed === true;
        if (closed && prob === 1) wonStageIds.add(s.id);
        if (closed && prob === 0) lostStageIds.add(s.id);
        if (s.metadata?.stageType === 'WON') wonStageIds.add(s.id);
        if (s.metadata?.stageType === 'LOST') lostStageIds.add(s.id);
      });
    });

    // Fetch all deals
    const props = [
      'dealname','amount','dealstage','closedate','createdate',
      'hubspot_owner_id','pipeline','hs_closed_won_date',
      'agent_firm_type','agent_use_case'
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
      ownerMap[o.id] = ((o.firstName||'') + (o.lastName ? ' '+o.lastName : '')).trim() || o.email || o.id;
    });

    // Fetch company associations via batch API
    const dealToCompany = {};
    let assocDebug = { status: null, error: null, resultCount: 0, sample: null };
    try {
      const testChunk = deals.slice(0, 10);
      const r = await fetch('https://api.hubapi.com/crm/v4/associations/deals/companies/batch/read', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: testChunk.map(d => ({ id: d.id })) })
      });
      assocDebug.status = r.status;
      const data = await r.json();
      assocDebug.sample = JSON.stringify(data).slice(0, 300);
      if (r.ok) {
        // Full run across all deals
        for (let i = 0; i < deals.length; i += 100) {
          const chunk = deals.slice(i, i + 100);
          const r2 = await fetch('https://api.hubapi.com/crm/v4/associations/deals/companies/batch/read', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: chunk.map(d => ({ id: d.id })) })
          });
          const data2 = await r2.json();
          (data2.results || []).forEach(result => {
            if (result.to && result.to.length > 0) {
              dealToCompany[result.from.id] = result.to[0].toObjectId;
              assocDebug.resultCount++;
            }
          });
        }
      }
    } catch(e) { assocDebug.error = e.message; }

    // Fetch unique company names
    const companyMap = {};
    const uniqueCompanyIds = [...new Set(Object.values(dealToCompany))];
    for (let i = 0; i < uniqueCompanyIds.length; i += 50) {
      const chunk = uniqueCompanyIds.slice(i, i + 50);
      await Promise.all(chunk.map(async cid => {
        try {
          const r = await fetch('https://api.hubapi.com/crm/v3/objects/companies/' + cid + '?properties=name', {
            headers: { Authorization: 'Bearer ' + token }
          });
          const d = await r.json();
          if (d.properties?.name) companyMap[cid] = d.properties.name;
        } catch(e) {}
      }));
    }

    // Build snapshot — open deals only
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = deals
      .filter(d => !wonStageIds.has(d.properties.dealstage) && !lostStageIds.has(d.properties.dealstage))
      .map(d => {
        const amount = parseFloat(d.properties.amount || 0);
        const prob = stageProbMap[d.properties.dealstage] || 0;
        const cid = dealToCompany[d.id];
        return {
          id: d.id,
          name: d.properties.dealname || '',
          amount, prob,
          los: amount * prob / 100,
          stage: d.properties.dealstage,
          stageLabel: stageLabelMap[d.properties.dealstage] || d.properties.dealstage,
          pipeline: d.properties.pipeline,
          owner: ownerMap[d.properties.hubspot_owner_id] || 'Unassigned',
          ownerId: d.properties.hubspot_owner_id || '',
          firmType: d.properties.agent_firm_type || '',
          useCase: d.properties.agent_use_case || '',
          closeDate: d.properties.closedate || '',
          company: cid ? (companyMap[cid] || '') : ''
        };
      });

    // Write snapshot to KV
    await kvSet('snapshot:' + today, JSON.stringify(snapshot));

    // Only add to index if we actually have deal data
    if (snapshot.length > 0) {
      let index = await kvGet('snapshot:index') || [];
      if (!Array.isArray(index)) index = [];
      // Remove any dates that are broken (keep only dates with valid data)
      // We trust today's entry since we just wrote it successfully
      if (!index.includes(today)) {
        index.unshift(today);
        index.sort().reverse();
        index = index.slice(0, 90);
        await kvSet('snapshot:index', JSON.stringify(index));
      }
    }

    return res.status(200).json({
      success: true, date: today,
      dealsSnapshotted: snapshot.length,
      totalDeals: deals.length,
      companiesResolved: Object.keys(companyMap).length,
      assocDebug
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
