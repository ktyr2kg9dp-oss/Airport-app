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
  return serveStatic(url, res);
});

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
      .map((p, i) => normalizeProperty(p, i))
      .filter((h) => h && h.offers.length > 0);

    return json(res, 200, {
      live: hotels.length > 0,
      reason: hotels.length ? "" : "No priced hotels returned for this search.",
      hotels,
    });
  } catch (err) {
    return json(res, 200, { live: false, reason: `Lookup failed: ${err.message}`, hotels: [] });
  }
}

/*
 * Turn one SerpApi Google Hotels property into the shape the front-end uses:
 * { id, name, lat, lng, reviewScore, reviewCount, pricePerNight, offers[] }.
 * Offers carry the real per-provider price and booking link.
 */
function normalizeProperty(p, i) {
  const gps = p.gps_coordinates || {};
  const lowest = p.rate_per_night && p.rate_per_night.extracted_lowest;

  // Per-provider prices (Booking.com, Expedia, Hotels.com, …).
  let offers = (p.prices || [])
    .map((pr) => ({
      provider: pr.source || "Provider",
      perNight: pr.rate_per_night && pr.rate_per_night.extracted_lowest,
      url: pr.link || p.link || "",
    }))
    .filter((o) => o.perNight != null && o.url);

  // Fall back to the property's headline nightly rate if no per-source breakdown.
  if (offers.length === 0 && lowest != null && p.link) {
    offers = [{ provider: "Google Hotels", perNight: lowest, url: p.link }];
  }

  offers.sort((a, b) => a.perNight - b.perNight);
  offers = offers.slice(0, 3); // three cheapest reservation outcomes

  if (offers.length === 0) return null;

  return {
    id: `serp-${i}`,
    name: p.name || "Hotel",
    lat: gps.latitude != null ? gps.latitude : null,
    lng: gps.longitude != null ? gps.longitude : null,
    reviewScore: p.overall_rating != null ? p.overall_rating : null,
    reviewCount: p.reviews != null ? p.reviews : 0,
    pricePerNight: offers[0].perNight,
    offers,
  };
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
