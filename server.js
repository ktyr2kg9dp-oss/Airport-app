/*
 * Oflights backend
 * ------------------------------------------------------------------
 * Serves the static app AND proxies live hotel prices from the SerpApi
 * Google Hotels API so your API key never reaches the browser.
 *
 * Run it:
 *     SERPAPI_KEY=your_key_here node server.js
 * then open http://localhost:3000
 *
 * Every hotel search the app makes hits /api/search here, which calls
 * Google Hotels (via SerpApi), reads the real per-provider prices, and
 * returns them. If SERPAPI_KEY is not set the endpoint reports that so the
 * front-end falls back to bundled sample data.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

const STATIC = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/search") {
    return handleSearch(url, res);
  }
  if (url.pathname === "/api/reviews") {
    return handleReviews(url, res);
  }
  if (url.pathname === "/api/place") {
    return handlePlace(url, res);
  }
  return serveStatic(url, res);
});

/* Build a SerpApi request URL for any engine (all engines share /search.json). */
function serpUrl(params) {
  const base = process.env.SERPAPI_BASE || "https://serpapi.com/search.json";
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("api_key", SERPAPI_KEY);
  return u.toString();
}

/* ------------------------------------------------------------------ */
/* Live price search                                                  */
/* ------------------------------------------------------------------ */
async function handleSearch(url, res) {
  const city = url.searchParams.get("city") || "";
  const checkin = url.searchParams.get("checkin") || "";
  const checkout = url.searchParams.get("checkout") || "";
  const adults = url.searchParams.get("adults") || "2";

  if (!SERPAPI_KEY) {
    return json(res, 200, {
      live: false,
      reason: "No SERPAPI_KEY set on the server — showing sample prices. Start the server with a key to get live prices.",
      hotels: [],
    });
  }
  if (!city || !checkin || !checkout) {
    return json(res, 400, { live: false, reason: "Missing city or dates.", hotels: [] });
  }

  const base = process.env.SERPAPI_BASE || "https://serpapi.com/search.json";
  const api = new URL(base);
  api.searchParams.set("engine", "google_hotels");
  api.searchParams.set("q", `${city} hotels`);
  api.searchParams.set("check_in_date", checkin);
  api.searchParams.set("check_out_date", checkout);
  api.searchParams.set("adults", adults);
  api.searchParams.set("currency", "USD");
  api.searchParams.set("gl", "us");
  api.searchParams.set("hl", "en");
  api.searchParams.set("api_key", SERPAPI_KEY);

  try {
    const r = await fetch(api.toString());
    const data = await r.json();

    if (data.error) {
      return json(res, 200, { live: false, reason: `SerpApi: ${data.error}`, hotels: [] });
    }

    const hotels = (data.properties || [])
      .map((p, i) => normalizeProperty(p, i, { city, checkin, checkout }))
      .filter((h) => h && h.offers.length > 0);

    return json(res, 200, {
      live: hotels.length > 0,
      reason: hotels.length ? "" : "No priced hotels returned for this search.",
      asOf: new Date().toISOString(),
      hotels,
    });
  } catch (err) {
    return json(res, 200, { live: false, reason: `Lookup failed: ${err.message}`, hotels: [] });
  }
}

/* ------------------------------------------------------------------ */
/* Geocoding (points of interest, any city)                           */
/* ------------------------------------------------------------------ */

const placeCache = new Map();
const PLACE_TTL_MS = 24 * 60 * 60 * 1000;

/* Resolve a free-typed place ("Eiffel Tower", "British Museum", …) to
 * coordinates via Google Maps, so distance works for any city / landmark. */
async function handlePlace(url, res) {
  const q = url.searchParams.get("q") || "";
  const city = url.searchParams.get("city") || "";
  if (!SERPAPI_KEY) return json(res, 200, { ok: false, reason: "no-key" });
  if (!q) return json(res, 400, { ok: false, reason: "missing query" });

  const cacheKey = `${q}|${city}`.toLowerCase();
  const hit = placeCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return json(res, 200, hit.value);

  try {
    const m = await (await fetch(serpUrl({
      engine: "google_maps", q: city ? `${q}, ${city}` : q, type: "search", hl: "en",
    }))).json();
    const pr = m.place_results;
    const lr = Array.isArray(m.local_results) ? m.local_results[0] : null;
    const g = (pr && pr.gps_coordinates) || (lr && lr.gps_coordinates);
    const name = (pr && pr.title) || (lr && lr.title) || q;
    if (!g || g.latitude == null) {
      return json(res, 200, { ok: false, reason: "not-found" });
    }
    const value = { ok: true, name, lat: g.latitude, lng: g.longitude };
    placeCache.set(cacheKey, { value, expires: Date.now() + PLACE_TTL_MS });
    return json(res, 200, value);
  } catch (err) {
    return json(res, 200, { ok: false, reason: err.message });
  }
}

/* ------------------------------------------------------------------ */
/* Deep review analysis                                               */
/* ------------------------------------------------------------------ */

// Cache analysed hotels for 6 hours to avoid re-spending API quota.
const reviewCache = new Map();
const REVIEW_TTL_MS = 6 * 60 * 60 * 1000;

const CLEAN_RE = /\b(clean|cleanlin|dirty|spotless|filth|tidy|hygien|stain|dust|mould|mold|smell|smelly|odou?r|grime|grimy|immaculate)\b/i;
const SERVICE_RE = /\b(service|staff|reception|receptionist|concierge|helpful|unhelpful|rude|friendly|welcom|host|hosts|manager|attentive|courteous|polite|professional)\b/i;

/*
 * Analyse real review text + star ratings. For each review that MENTIONS a
 * topic, its star rating decides the sentiment (>=4 positive, <=2 negative,
 * 3 neutral/ignored). Score = positive / (positive + negative) of the mentions.
 */
function analyzeReviews(reviews) {
  let cP = 0, cN = 0, sP = 0, sN = 0;
  for (const r of reviews || []) {
    const rating = typeof r.rating === "number" ? r.rating : null;
    const text = String(r.snippet || r.description || r.text || "");
    if (rating == null || !text) continue;
    if (CLEAN_RE.test(text)) { if (rating >= 4) cP++; else if (rating <= 2) cN++; }
    if (SERVICE_RE.test(text)) { if (rating >= 4) sP++; else if (rating <= 2) sN++; }
  }
  const pct = (p, n) => (p + n) > 0 ? Math.round((p / (p + n)) * 100) : null;
  return {
    cleanliness: pct(cP, cN), service: pct(sP, sN),
    cleanlinessCount: cP + cN, serviceCount: sP + sN,
  };
}

/*
 * Analyse one hotel's real Google reviews: find the place on Google Maps to get
 * its data_id, pull up to two pages of reviews, then score cleanliness/service
 * from the actual review text. Results are cached.
 */
async function handleReviews(url, res) {
  const hotel = url.searchParams.get("hotel") || "";
  const city = url.searchParams.get("city") || "";

  if (!SERPAPI_KEY) return json(res, 200, { ok: false, reason: "no-key" });
  if (!hotel) return json(res, 400, { ok: false, reason: "missing hotel" });

  const cacheKey = `${hotel}|${city}`.toLowerCase();
  const hit = reviewCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return json(res, 200, hit.value);

  try {
    // 1) Locate the place to obtain a Google Maps data_id.
    const maps = await (await fetch(serpUrl({
      engine: "google_maps", q: `${hotel}, ${city}`, type: "search", hl: "en",
    }))).json();
    const dataId =
      (maps.place_results && maps.place_results.data_id) ||
      (Array.isArray(maps.local_results) && maps.local_results[0] && maps.local_results[0].data_id);
    if (!dataId) {
      const v = { ok: false, reason: "place-not-found" };
      return json(res, 200, v);
    }

    // 2) Pull up to two pages of real reviews.
    let reviews = [];
    let token = null;
    for (let page = 0; page < 2; page++) {
      const params = { engine: "google_maps_reviews", data_id: dataId, hl: "en" };
      if (token) params.next_page_token = token;
      const rr = await (await fetch(serpUrl(params))).json();
      if (Array.isArray(rr.reviews)) reviews = reviews.concat(rr.reviews);
      token = rr.serpapi_pagination && rr.serpapi_pagination.next_page_token;
      if (!token) break;
    }

    // 3) Score from the actual review text.
    const analysis = analyzeReviews(reviews);
    const value = { ok: true, ...analysis, reviewsAnalyzed: reviews.length };
    reviewCache.set(cacheKey, { value, expires: Date.now() + REVIEW_TTL_MS });
    return json(res, 200, value);
  } catch (err) {
    return json(res, 200, { ok: false, reason: err.message });
  }
}

/*
 * Booking links that carry the hotel name AND the searched dates, so clicking
 * "Reserve" opens the provider on the exact dates the user searched (rather than
 * the site's default dates, which may look sold out).
 */
function datedProviderLink(source, hotelName, ctx) {
  const q = encodeURIComponent(`${hotelName}, ${ctx.city}`);
  const { checkin: ci, checkout: co } = ctx;
  const s = String(source || "").toLowerCase();
  if (s.includes("booking"))
    return `https://www.booking.com/searchresults.html?ss=${q}&checkin=${ci}&checkout=${co}`;
  if (s.includes("expedia"))
    return `https://www.expedia.com/Hotel-Search?destination=${q}&startDate=${ci}&endDate=${co}`;
  if (s.includes("hotels.com"))
    return `https://www.hotels.com/Hotel-Search?destination=${q}&checkIn=${ci}&checkOut=${co}`;
  return null; // unknown source → fall back to the link SerpApi supplied
}

/*
 * Turn one SerpApi Google Hotels property into the shape the front-end uses:
 * { id, name, lat, lng, reviewScore, reviewCount, pricePerNight, offers[] }.
 * Offers carry the real per-provider price and a dated booking link.
 */
function normalizeProperty(p, i, ctx) {
  const gps = p.gps_coordinates || {};
  const lowest = p.rate_per_night && p.rate_per_night.extracted_lowest;

  // Per-provider prices (Booking.com, Expedia, Hotels.com, …).
  let offers = (p.prices || [])
    .map((pr) => ({
      provider: pr.source || "Provider",
      perNight: pr.rate_per_night && pr.rate_per_night.extracted_lowest,
      url: datedProviderLink(pr.source, p.name, ctx) || pr.link || p.link || "",
    }))
    .filter((o) => o.perNight != null && o.url);

  // Fall back to the property's headline nightly rate if no per-source breakdown.
  if (offers.length === 0 && lowest != null && p.link) {
    offers = [{ provider: "Google Hotels", perNight: lowest, url: p.link }];
  }

  offers.sort((a, b) => a.perNight - b.perNight);
  offers = offers.slice(0, 3); // three cheapest priced reservation outcomes

  if (offers.length === 0) return null;

  // Always surface 3 options: if Google returned fewer priced sources, top up
  // with dated links to the major providers not already listed. These carry no
  // price (marked compareOnly) — the user checks the live rate on the site.
  const MAJORS = ["Booking.com", "Expedia", "Hotels.com"];
  const key = (s) => String(s).toLowerCase().replace(".com", "");
  const have = offers.map((o) => key(o.provider));
  for (const m of MAJORS) {
    if (offers.length >= 3) break;
    if (have.some((h) => h.includes(key(m)) || key(m).includes(h))) continue;
    offers.push({ provider: m, perNight: null, url: datedProviderLink(m, p.name, ctx), compareOnly: true });
    have.push(key(m));
  }

  return {
    id: `serp-${i}`,
    name: p.name || "Hotel",
    lat: gps.latitude != null ? gps.latitude : null,
    lng: gps.longitude != null ? gps.longitude : null,
    reviewScore: p.overall_rating != null ? p.overall_rating : null,
    reviewCount: p.reviews != null ? p.reviews : 0,
    cleanliness: sentimentPct(p.reviews_breakdown, /clean/i),
    service: sentimentPct(p.reviews_breakdown, /service/i),
    pricePerNight: offers[0].perNight,
    offers,
  };
}

/*
 * Google Hotels returns a per-category review sentiment breakdown
 * (reviews_breakdown: [{ name, positive, negative, neutral }, …]). Convert the
 * matching category into a "% of mentions that were positive" score, or null
 * when that category isn't reported for the hotel.
 */
function sentimentPct(breakdown, categoryRe) {
  if (!Array.isArray(breakdown)) return null;
  const cat = breakdown.find((b) => categoryRe.test(String(b.name || "")));
  if (!cat) return null;
  const pos = cat.positive || 0;
  const total = pos + (cat.negative || 0) + (cat.neutral || 0);
  if (!total) return null;
  return Math.round((pos / total) * 100);
}

/* ------------------------------------------------------------------ */
/* Static file serving                                                */
/* ------------------------------------------------------------------ */
function serveStatic(url, res) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(__dirname, path.normalize(pathname));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": STATIC[ext] || "application/octet-stream" });
    res.end(buf);
  });
}

function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(s);
}

server.listen(PORT, () => {
  console.log(`Oflights running at http://localhost:${PORT}`);
  console.log(SERPAPI_KEY
    ? "Live prices: ENABLED (SERPAPI_KEY found)."
    : "Live prices: OFF — set SERPAPI_KEY to enable. Falling back to sample data.");
});
