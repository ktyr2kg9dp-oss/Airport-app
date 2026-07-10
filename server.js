/*
 * BD App backend
 * ------------------------------------------------------------------
 * Serves the static front-end AND powers two BD workflows:
 *
 *   /api/opportunities  – active government competitions (Sources Sought,
 *                         RFI, Presolicitation, RFP/RFQ, Combined Synopsis).
 *                         For the US it queries the live SAM.gov Opportunities
 *                         API (needs a free SAM_API_KEY). For NATO / other
 *                         countries it returns deep links into each country's
 *                         official procurement portal, pre-filled with the
 *                         search term. Labeled sample notices are shown when no
 *                         live data is available so the app is useful offline.
 *
 *   /api/companies      – primes, SMEs and startups developing the interest
 *                         area in the selected country, from a curated DB
 *                         (data.js), optionally enriched with real web results
 *                         via SerpApi when SERPAPI_KEY is set.
 *
 * Run it:
 *     SAM_API_KEY=xxxx SERPAPI_KEY=yyyy node server.js
 * then open http://localhost:3000  (both keys are optional).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const DATA = require("./data.js");

const PORT = process.env.PORT || 3000;
const SAM_API_KEY = process.env.SAM_API_KEY || "";
const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

const STATIC = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/meta") return handleMeta(res);
  if (url.pathname === "/api/opportunities") return handleOpportunities(url, res);
  if (url.pathname === "/api/companies") return handleCompanies(url, res);
  if (url.pathname === "/api/images") return handleImages(url, res);
  return serveStatic(url, res);
});

/* ------------------------------------------------------------------ */
/* Meta — feeds the front-end pickers (no functions, JSON-safe)        */
/* ------------------------------------------------------------------ */
function handleMeta(res) {
  const countries = DATA.COUNTRIES.map((c) => ({
    code: c.code, name: c.name, flag: c.flag, nato: !!c.nato, live: !!c.live,
  }));
  return json(res, 200, {
    countries,
    noticeTypes: DATA.NOTICE_TYPES,
    domains: Object.entries(DATA.DOMAINS).map(([k, d]) => ({ key: k, label: d.label })),
    liveSam: !!SAM_API_KEY,
    liveCompanies: !!SERPAPI_KEY,
  });
}

/* ------------------------------------------------------------------ */
/* Opportunities                                                      */
/* ------------------------------------------------------------------ */
function portalsFor(countryCode, q) {
  const c = DATA.COUNTRIES.find((x) => x.code === countryCode);
  if (!c) return [];
  return c.portals.map((p) => ({ name: p.name, url: p.url(q) }));
}

async function handleOpportunities(url, res) {
  const q = (url.searchParams.get("interest") || "").trim();
  const country = url.searchParams.get("country") || "US";
  const types = (url.searchParams.get("types") || "r,i,p,o,k").split(",").filter(Boolean);

  const portals = portalsFor(country, q || "defense");

  // Live US federal opportunities via SAM.gov.
  if (country === "US" && SAM_API_KEY && q) {
    try {
      const live = await fetchSam(q, types);
      return json(res, 200, {
        live: true, source: "SAM.gov", country, portals,
        opportunities: live,
        note: live.length ? "" : "No SAM.gov notices matched that keyword in the title over the last 90 days. Try a broader term or use the SAM.gov link below (it searches full text).",
      });
    } catch (err) {
      return json(res, 200, {
        live: false, source: "sample", country, portals,
        opportunities: sampleOpportunities(q, country),
        note: `SAM.gov lookup failed (${err.message}). Showing sample notices — use the portal links below for live results.`,
      });
    }
  }

  // NATO / non-US, or no key: portals + labeled samples.
  const reason = country === "US" && !SAM_API_KEY
    ? "Set SAM_API_KEY on the server for live SAM.gov results. Showing sample notices meanwhile."
    : "No free unified API exists for this jurisdiction — use the official portal links below (pre-filled with your search). Sample notices shown for reference.";
  return json(res, 200, {
    live: false, source: "sample", country, portals,
    opportunities: sampleOpportunities(q, country),
    note: reason,
  });
}

/* SAM.gov Get Opportunities Public API v2.
 * Keyword search is on the notice title; date window is required (<=1yr). */
async function fetchSam(q, types) {
  const base = "https://api.sam.gov/opportunities/v2/search";
  const api = new URL(base);
  const today = new Date();
  const from = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  api.searchParams.set("api_key", SAM_API_KEY);
  api.searchParams.set("title", q);
  api.searchParams.set("postedFrom", samDate(from));
  api.searchParams.set("postedTo", samDate(today));
  api.searchParams.set("limit", "50");
  if (types.length) api.searchParams.set("ptype", types.join(","));

  const r = await fetch(api.toString());
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const rows = data.opportunitiesData || [];
  return rows.map((o) => ({
    title: o.title || "(untitled)",
    agency: o.fullParentPathName || o.organizationType || "",
    type: o.type || "",
    solNum: o.solicitationNumber || "",
    posted: o.postedDate || "",
    deadline: o.responseDeadLine || "",
    naics: o.naicsCode || "",
    setAside: o.typeOfSetAsideDescription || "",
    active: String(o.active).toLowerCase() === "yes" || o.active === true,
    url: o.uiLink || "",
  })).sort((a, b) => (b.posted || "").localeCompare(a.posted || ""));
}

function samDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/* Illustrative sample notices so the app demonstrates value with no key.
 * Clearly flagged as samples in the UI. */
function sampleOpportunities(q, country) {
  const topic = q || "defense capability";
  const c = DATA.COUNTRIES.find((x) => x.code === country);
  const agency = country === "US" ? "Dept. of Defense" :
    country === "NATO" ? "NSPA / NCIA" :
    country === "EUROPE" ? "EU / EDA (member MoDs)" : `${c ? c.name : ""} MoD`;
  const mk = (title, type, days, sole) => ({
    title, agency, type, solNum: "SAMPLE", posted: "", deadline: `${days} days`,
    naics: "", setAside: sole || "", active: true, url: "", sample: true,
  });
  return [
    mk(`Sources Sought — ${topic} capabilities & market survey`, "Sources Sought", 21, "Small Business"),
    mk(`Request for Information (RFI): ${topic} solutions`, "RFI / Special Notice", 30, ""),
    mk(`Presolicitation — upcoming ${topic} procurement`, "Presolicitation", 45, ""),
    mk(`Combined Synopsis/Solicitation for ${topic}`, "Combined Synopsis / Solicitation", 35, ""),
  ];
}

/* ------------------------------------------------------------------ */
/* Companies                                                          */
/* ------------------------------------------------------------------ */
async function handleCompanies(url, res) {
  const interest = (url.searchParams.get("interest") || "").trim();
  const country = url.searchParams.get("country") || "ANY";

  const { domains, companies } = DATA.searchCompanies(interest, country);
  const domainLabels = domains.map((d) => DATA.DOMAINS[d] && DATA.DOMAINS[d].label).filter(Boolean);

  let web = [];
  let webNote = "";
  if (SERPAPI_KEY && interest) {
    try {
      web = await serpCompanySearch(interest, country);
    } catch (err) {
      webNote = `Live web search failed: ${err.message}`;
    }
  } else if (!SERPAPI_KEY) {
    webNote = "Set SERPAPI_KEY on the server to also pull live web results for startups not yet in the curated list.";
  }

  return json(res, 200, {
    interest, country, domains: domainLabels,
    curated: companies,
    web, webNote,
    searchLink: googleSearchLink(interest, country),
  });
}

/* Human Google search link as a fallback / "keep digging" affordance. */
function googleSearchLink(interest, countryCode) {
  const c = DATA.COUNTRIES.find((x) => x.code === countryCode);
  const where = countryCode === "NATO" ? "NATO" : countryCode === "EUROPE" ? "Europe" : c ? c.name : "";
  const q = `${interest} defense companies and startups ${where}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/* Optional live enrichment via SerpApi Google search. */
async function serpCompanySearch(interest, countryCode) {
  const c = DATA.COUNTRIES.find((x) => x.code === countryCode);
  const where = countryCode === "NATO" ? "" : countryCode === "EUROPE" ? "Europe" : c ? c.name : "";
  const q = `${interest} defense company OR startup ${where}`.trim();
  const base = process.env.SERPAPI_BASE || "https://serpapi.com/search.json";
  const api = new URL(base);
  api.searchParams.set("engine", "google");
  api.searchParams.set("q", q);
  api.searchParams.set("num", "10");
  api.searchParams.set("hl", "en");
  api.searchParams.set("api_key", SERPAPI_KEY);
  const r = await fetch(api.toString());
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return (data.organic_results || []).slice(0, 8).map((o) => ({
    title: o.title || "",
    snippet: o.snippet || "",
    url: o.link || "",
    source: (o.displayed_link || "").split("/")[0] || "",
  }));
}

/* ------------------------------------------------------------------ */
/* Product photos (SerpApi Google Images)                             */
/* ------------------------------------------------------------------ */
const imageCache = new Map();
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;

async function handleImages(url, res) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json(res, 400, { ok: false, images: [] });
  if (!SERPAPI_KEY) return json(res, 200, { ok: false, reason: "no-key", images: [] });

  const key = q.toLowerCase();
  const hit = imageCache.get(key);
  if (hit && hit.expires > Date.now()) return json(res, 200, hit.value);

  try {
    const base = process.env.SERPAPI_BASE || "https://serpapi.com/search.json";
    const api = new URL(base);
    api.searchParams.set("engine", "google_images");
    api.searchParams.set("q", q);
    api.searchParams.set("hl", "en");
    api.searchParams.set("api_key", SERPAPI_KEY);
    const data = await (await fetch(api.toString())).json();
    if (data.error) throw new Error(data.error);
    const images = (data.images_results || [])
      .slice(0, 2)
      .map((i) => ({ thumb: i.thumbnail, link: i.link || i.source || "" }))
      .filter((i) => i.thumb);
    const value = { ok: images.length > 0, images };
    imageCache.set(key, { value, expires: Date.now() + IMAGE_TTL_MS });
    return json(res, 200, value);
  } catch (err) {
    return json(res, 200, { ok: false, reason: err.message, images: [] });
  }
}

/* ------------------------------------------------------------------ */
/* Static file serving                                                */
/* ------------------------------------------------------------------ */
function serveStatic(url, res) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.join(__dirname, path.normalize(pathname));
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": STATIC[ext] || "application/octet-stream" });
    res.end(buf);
  });
}

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

server.listen(PORT, () => {
  console.log(`BD App running at http://localhost:${PORT}`);
  console.log(SAM_API_KEY ? "SAM.gov: live" : "SAM.gov: OFF (set SAM_API_KEY) — sample notices only.");
  console.log(SERPAPI_KEY ? "Web company search: live" : "Web company search: OFF (set SERPAPI_KEY) — curated DB only.");
});
