# O·Biz — Business Growth

A **business-development scouting tool** for defense & dual-use technology.

Type an interest area (e.g. *drones*, *helicopters*, *counter-UAS*, *loitering
munitions*), pick a **country or NATO**, and BD Scout returns:

1. **🎯 Active competitions** — Sources Sought, RFI / Special Notices,
   Presolicitations, Solicitations (RFP/RFQ) and Combined Synopsis notices,
   plus deep links into the relevant official procurement portal.
2. **🏭 Companies & startups** — primes, SMEs and startups developing that
   technology in the selected country, sorted **startups-first**. Each card
   carries a **📷 Photos** link (Google Images for that company + product) and,
   when `SERPAPI_KEY` is set, shows **two inline product thumbnails**.

## How it works

| Data | Source | Key needed? |
|------|--------|-------------|
| US federal competitions | Live **[SAM.gov Opportunities API](https://open.gsa.gov/api/get-opportunities-public-api/)** | `SAM_API_KEY` (free) — falls back to sample notices + SAM.gov deep link |
| NATO & other countries | Deep links into the official portal (NSPA/NCIA e-Portal, EU TED, UK Find a Tender, CanadaBuys, AusTender, …), pre-filled with your search | none |
| Companies & startups | Curated, country-tagged database in `data.js` | none — optionally enriched with live web results via `SERPAPI_KEY` |

Both API keys are **optional**. With no keys the app is fully usable through the
official portal links, the curated company database, and clearly-labeled sample
notices.

> ⚠️ The company list is curated and illustrative — always verify a company's
> current status, ownership and offerings before outreach.

## Run it

**No install — just open the standalone build.** `standalone.html` is a single
self-contained file that runs the whole app client-side (interest input,
country/NATO selector, portal deep-links + sample notices, and the full
company/startup database). Double-click it or host it anywhere. The only thing
it can't do is *live* SAM.gov listings (that needs the Node server + a key).

**Full app with live data — run the server:**

```bash
npm install          # no third-party deps; uses Node's built-in http/fetch
node server.js
# open http://localhost:3000
```

Enable live data:

```bash
SAM_API_KEY=your_sam_key SERPAPI_KEY=your_serpapi_key node server.js
```

- **SAM_API_KEY** — free from the [SAM.gov / api.data.gov](https://open.gsa.gov/api/get-opportunities-public-api/) get-opportunities public API.
- **SERPAPI_KEY** — optional; adds live web results to the company section.

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/meta` | Countries, notice types and domains for the UI pickers |
| `GET /api/opportunities?interest=drones&country=US&types=r,i,p,o,k` | Competitions + portal links |
| `GET /api/companies?interest=drones&country=NATO` | Curated companies (+ web results if enabled) |
| `GET /api/images?q=Skydio%20drones` | Up to 2 product thumbnails (needs `SERPAPI_KEY`) |

Notice-type codes map to SAM.gov `ptype`: `r` Sources Sought · `i` RFI/Special
Notice · `p` Presolicitation · `o` Solicitation (RFP/RFQ) · `k` Combined
Synopsis/Solicitation · `a` Award Notice.

## Notes & limitations

- SAM.gov's public API matches keywords against the **notice title** and needs a
  posted-date window (BD Scout uses the last 90 days). For full-text search use
  the SAM.gov portal link the app provides.
- There is no free unified API for NATO / non-US tenders, so those jurisdictions
  are handled via authoritative portal deep-links rather than inline results.
- Selecting **NATO** expands the company search across all 32 member states.

## Files

- `index.html` / `styles.css` / `app.js` — front-end
- `server.js` — Node backend (SAM.gov proxy, portal links, company search)
- `data.js` — shared data: notice types, countries + portals, technology
  domains, and the curated company database (works in Node and the browser)
- `render.yaml` — one-click Render deployment
