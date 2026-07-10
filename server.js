/*
 * O·Dine backend
 * ------------------------------------------------------------------
 * Serves the static app AND proxies real restaurant listings from the Google
 * Places API so your API key never reaches the browser.
 *
 * Run it:
 *     GOOGLE_PLACES_KEY=your_key_here node server.js
 * then open http://localhost:3000
 *
 * With a key, every search hits /api/restaurants here, which calls Google
 * Places (New) "Nearby Search" for real restaurants around the point and
 * returns their name, location, rating, price level, opening hours and Google
 * listing link. Without a key the endpoint says so and the front-end falls
 * back to the bundled curated sample, so the app still runs.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY || "";

const STATIC = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") {
    return json(res, 200, { ok: true, app: "odine", live: Boolean(GOOGLE_PLACES_KEY) });
  }
  if (url.pathname === "/api/restaurants") {
    return handleRestaurants(url, res);
  }
  serveStatic(url, res);
});

/* ------------------------------------------------------------------ */
/* Real restaurant listings (Google Places API — New)                 */
/* ------------------------------------------------------------------ */
async function handleRestaurants(url, res) {
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radius = Math.min(50000, Math.max(50, Number(url.searchParams.get("radius")) || 3000));

  if (!GOOGLE_PLACES_KEY) {
    return json(res, 200, {
      live: false,
      reason: "No GOOGLE_PLACES_KEY set on the server — showing the curated sample. Set the key to get real restaurants from Google.",
      restaurants: [],
    });
  }
  if (!isFinite(lat) || !isFinite(lng)) {
    return json(res, 400, { live: false, reason: "Missing lat/lng.", restaurants: [] });
  }

  try {
    const body = {
      includedTypes: ["restaurant"],
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      regionCode: "IL",
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    };
    const r = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": [
          "places.id", "places.displayName", "places.location", "places.rating",
          "places.userRatingCount", "places.priceLevel", "places.regularOpeningHours",
          "places.googleMapsUri", "places.formattedAddress", "places.primaryTypeDisplayName",
        ].join(","),
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();

    if (data.error) {
      return json(res, 200, { live: false, reason: `Google Places: ${data.error.message || data.error.status}`, restaurants: [] });
    }

    const restaurants = (data.places || []).map(normalizePlace).filter(Boolean);
    return json(res, 200, {
      live: restaurants.length > 0,
      reason: restaurants.length ? "" : "No restaurants returned for this area.",
      asOf: new Date().toISOString(),
      restaurants,
    });
  } catch (err) {
    return json(res, 200, { live: false, reason: `Lookup failed: ${err.message}`, restaurants: [] });
  }
}

const PRICE_LEVELS = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/* Turn one Google Places result into the shape the front-end uses. Opening
 * hours are flattened to numeric periods so the app can test any date/time. */
function normalizePlace(p) {
  const loc = p.location || {};
  if (loc.latitude == null || loc.longitude == null) return null;

  const periods = (p.regularOpeningHours && Array.isArray(p.regularOpeningHours.periods))
    ? p.regularOpeningHours.periods.map((per) => ({
        od: per.open ? per.open.day : null,
        om: per.open ? (per.open.hour || 0) * 60 + (per.open.minute || 0) : null,
        cd: per.close ? per.close.day : null,
        cm: per.close ? (per.close.hour || 0) * 60 + (per.close.minute || 0) : null,
      }))
    : [];

  return {
    id: p.id,
    name: (p.displayName && p.displayName.text) || "Restaurant",
    lat: loc.latitude,
    lng: loc.longitude,
    rating: p.rating != null ? p.rating : null,
    reviewCount: p.userRatingCount || 0,
    priceLevel: PRICE_LEVELS[p.priceLevel] || null,
    cuisine: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || "Restaurant",
    address: p.formattedAddress || "",
    mapsUri: p.googleMapsUri || "",
    periods,
    hoursText: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || [],
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
    res.writeHead(403);
    return res.end("Forbidden");
  }

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
  console.log(`O·Dine running at http://localhost:${PORT}`);
  console.log(GOOGLE_PLACES_KEY
    ? "Real restaurants: ENABLED (GOOGLE_PLACES_KEY found)."
    : "Real restaurants: OFF — set GOOGLE_PLACES_KEY to enable. Falling back to the curated sample.");
});
