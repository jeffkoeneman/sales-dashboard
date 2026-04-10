# Sales Dashboard — Deploy to Vercel

## What this is
A live HubSpot sales dashboard that syncs your deals, pipeline, LoS, velocity, and ARR targets.
Calls HubSpot through a serverless proxy (fixes CORS) so anyone can open it in a browser.

## Deploy in 3 steps

### 1. Install Vercel CLI (one time)
```
npm install -g vercel
```

### 2. Deploy
```
cd sales-dashboard
vercel
```
Follow the prompts — say Yes to defaults. Vercel gives you a URL like `https://sales-dashboard-xyz.vercel.app`.

### 3. Set your HubSpot token as an environment variable
In the Vercel dashboard → your project → Settings → Environment Variables:
- Name: `HUBSPOT_TOKEN`
- Value: your `pat-na1-...` token
- Environment: Production + Preview

Then redeploy:
```
vercel --prod
```

## Done
Open your Vercel URL. The dashboard loads your live HubSpot data.
No login required — share the URL with anyone on your team.

## Files
```
sales-dashboard/
  api/
    hubspot.js       ← serverless proxy (handles CORS)
  public/
    index.html       ← full dashboard UI
  vercel.json        ← routing config
  package.json
```

## To refresh the token
Go to HubSpot → Settings → Private Apps → your app → Rotate token.
Update the `HUBSPOT_TOKEN` env var in Vercel and redeploy.

## Required HubSpot scopes
- crm.objects.deals.read
- crm.objects.contacts.read
- crm.objects.owners.read
