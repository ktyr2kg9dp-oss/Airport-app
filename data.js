/*
 * Otable bundled dataset
 * ------------------------------------------------------------------
 * Self-contained data + availability engine for the Otable app. It provides:
 *   - a list of world cities (for the "search by city" box + the map),
 *   - a deterministic generator that places restaurants around any point
 *     (a city centre OR a point the user clicked on the map),
 *   - a table-availability engine that answers "does this restaurant have a
 *     free table for N people at time T on date D?".
 *
 * Everything is generated deterministically from a seed so results are stable
 * between reloads for the same area/date. No API keys, no build step.
 *
 * To use LIVE restaurant data instead (e.g. Google Places / a reservation
 * provider) replace `getRestaurants` + `seatingAt` with real calls; the rest of
 * the app only depends on the shape of the objects returned here.
 */

/* Major world cities (name, country, latitude, longitude). */
const CITIES = [
  { name: "Paris",        country: "France",         lat: 48.8566, lng: 2.3522 },
  { name: "London",       country: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { name: "New York",     country: "United States",  lat: 40.7128, lng: -74.0060 },
  { name: "Tokyo",        country: "Japan",          lat: 35.6762, lng: 139.6503 },
  { name: "Rome",         country: "Italy",          lat: 41.9028, lng: 12.4964 },
  { name: "Barcelona",    country: "Spain",          lat: 41.3874, lng: 2.1686 },
  { name: "Amsterdam",    country: "Netherlands",    lat: 52.3676, lng: 4.9041 },
  { name: "Dubai",        country: "UAE",            lat: 25.2048, lng: 55.2708 },
  { name: "Singapore",    country: "Singapore",      lat: 1.3521,  lng: 103.8198 },
  { name: "Sydney",       country: "Australia",      lat: -33.8688, lng: 151.2093 },
  { name: "Istanbul",     country: "Turkey",         lat: 41.0082, lng: 28.9784 },
  { name: "San Francisco",country: "United States",  lat: 37.7749, lng: -122.4194 },
  { name: "Berlin",       country: "Germany",        lat: 52.5200, lng: 13.4050 },
  { name: "Madrid",       country: "Spain",          lat: 40.4168, lng: -3.7038 },
  { name: "Lisbon",       country: "Portugal",       lat: 38.7223, lng: -9.1393 },
  { name: "Vienna",       country: "Austria",        lat: 48.2082, lng: 16.3738 },
  { name: "Prague",       country: "Czechia",        lat: 50.0755, lng: 14.4378 },
  { name: "Munich",       country: "Germany",        lat: 48.1351, lng: 11.5820 },
  { name: "Milan",        country: "Italy",          lat: 45.4642, lng: 9.1900 },
  { name: "Venice",       country: "Italy",          lat: 45.4408, lng: 12.3155 },
  { name: "Florence",     country: "Italy",          lat: 43.7696, lng: 11.2558 },
  { name: "Zurich",       country: "Switzerland",    lat: 47.3769, lng: 8.5417 },
  { name: "Athens",       country: "Greece",         lat: 37.9838, lng: 23.7275 },
  { name: "Dublin",       country: "Ireland",        lat: 53.3498, lng: -6.2603 },
  { name: "Copenhagen",   country: "Denmark",        lat: 55.6761, lng: 12.5683 },
  { name: "Stockholm",    country: "Sweden",         lat: 59.3293, lng: 18.0686 },
  { name: "Oslo",         country: "Norway",         lat: 59.9139, lng: 10.7522 },
  { name: "Helsinki",     country: "Finland",        lat: 60.1699, lng: 24.9384 },
  { name: "Brussels",     country: "Belgium",        lat: 50.8503, lng: 4.3517 },
  { name: "Budapest",     country: "Hungary",        lat: 47.4979, lng: 19.0402 },
  { name: "Warsaw",       country: "Poland",         lat: 52.2297, lng: 21.0122 },
  { name: "Los Angeles",  country: "United States",  lat: 34.0522, lng: -118.2437 },
  { name: "Chicago",      country: "United States",  lat: 41.8781, lng: -87.6298 },
  { name: "Miami",        country: "United States",  lat: 25.7617, lng: -80.1918 },
  { name: "Las Vegas",    country: "United States",  lat: 36.1699, lng: -115.1398 },
  { name: "Boston",       country: "United States",  lat: 42.3601, lng: -71.0589 },
  { name: "Toronto",      country: "Canada",         lat: 43.6532, lng: -79.3832 },
  { name: "Vancouver",    country: "Canada",         lat: 49.2827, lng: -123.1207 },
  { name: "Mexico City",  country: "Mexico",         lat: 19.4326, lng: -99.1332 },
  { name: "Rio de Janeiro",country:"Brazil",         lat: -22.9068, lng: -43.1729 },
  { name: "Buenos Aires", country: "Argentina",      lat: -34.6037, lng: -58.3816 },
  { name: "Cairo",        country: "Egypt",          lat: 30.0444, lng: 31.2357 },
  { name: "Cape Town",    country: "South Africa",   lat: -33.9249, lng: 18.4241 },
  { name: "Bangkok",      country: "Thailand",       lat: 13.7563, lng: 100.5018 },
  { name: "Hong Kong",    country: "China",          lat: 22.3193, lng: 114.1694 },
  { name: "Seoul",        country: "South Korea",    lat: 37.5665, lng: 126.9780 },
  { name: "Beijing",      country: "China",          lat: 39.9042, lng: 116.4074 },
  { name: "Shanghai",     country: "China",          lat: 31.2304, lng: 121.4737 },
  { name: "Mumbai",       country: "India",          lat: 19.0760, lng: 72.8777 },
  { name: "Delhi",        country: "India",          lat: 28.6139, lng: 77.2090 },
  { name: "Kuala Lumpur", country: "Malaysia",       lat: 3.1390,  lng: 101.6869 },
  { name: "Marrakesh",    country: "Morocco",        lat: 31.6295, lng: -7.9811 },
  { name: "Tel Aviv",     country: "Israel",         lat: 32.0853, lng: 34.7818 },
  { name: "Jerusalem",    country: "Israel",         lat: 31.7683, lng: 35.2137 },
];

/* Small, deterministic pseudo-random generator (mulberry32) so a given area
 * always produces the same restaurants + availability between reloads. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Haversine distance in kilometres between two {lat,lng} points. */
function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ------------------------------------------------------------------ */
/* Restaurant catalogue generation                                    */
/* ------------------------------------------------------------------ */

const CUISINES = [
  { name: "Italian",       emoji: "🍝" },
  { name: "Japanese",      emoji: "🍣" },
  { name: "French",        emoji: "🥐" },
  { name: "Indian",        emoji: "🍛" },
  { name: "Mexican",       emoji: "🌮" },
  { name: "Thai",          emoji: "🍜" },
  { name: "Steakhouse",    emoji: "🥩" },
  { name: "Mediterranean", emoji: "🫒" },
  { name: "Seafood",       emoji: "🦞" },
  { name: "American",      emoji: "🍔" },
  { name: "Chinese",       emoji: "🥡" },
  { name: "Spanish",       emoji: "🥘" },
  { name: "Korean",        emoji: "🍲" },
  { name: "Vietnamese",    emoji: "🍜" },
  { name: "Greek",         emoji: "🥙" },
];

const NAME_ADJ = [
  "The Golden", "Little", "Old", "Blue", "Rustic", "Urban", "Copper", "Green",
  "Royal", "Corner", "Riverside", "Garden", "Silver", "The Hungry", "Maison",
  "Bella", "Casa", "The Velvet", "Nonna's", "The Salt",
];
const NAME_NOUN = [
  "Fork", "Table", "Kitchen", "Bistro", "House", "Spoon", "Plate", "Grill",
  "Cellar", "Terrace", "Olive", "Lantern", "Room", "Feast", "Pantry", "Larder",
];

/* Overall dinner window the UI offers (minutes since midnight). */
const DINNER_START_MIN = 17 * 60;   // 17:00
const DINNER_END_MIN = 22 * 60 + 30; // 22:30
const SLOT_STEP = 30;                // reservations are on a 30-minute grid
const DINING_MINUTES = 90;           // a table is held ~90 minutes

/* Restaurants are placed within this radius of the chosen point and then
 * filtered to the user's search radius, so widening the search reveals more of
 * the same restaurants rather than reshuffling them. */
const MAX_SPREAD_KM = 7;
const POOL_SIZE = 70;

/* Build the mix of tables for one restaurant (by number of seats). */
function makeTables(rng) {
  const tables = [];
  tables.push({ seats: 2, count: 3 + Math.floor(rng() * 6) }); // 3–8 two-tops
  tables.push({ seats: 4, count: 3 + Math.floor(rng() * 5) }); // 3–7 four-tops
  if (rng() < 0.85) tables.push({ seats: 6, count: 1 + Math.floor(rng() * 3) });
  if (rng() < 0.55) tables.push({ seats: 8, count: 1 + Math.floor(rng() * 2) });
  if (rng() < 0.25) tables.push({ seats: 10, count: 1 });
  if (rng() < 0.12) tables.push({ seats: 12, count: 1 });
  return tables;
}

const OPEN_CHOICES = [17 * 60, 17 * 60 + 30, 18 * 60];        // 17:00 / 17:30 / 18:00
const CLOSE_CHOICES = [21 * 60 + 30, 22 * 60, 22 * 60 + 30, 23 * 60]; // 21:30–23:00

/*
 * Generate the restaurants around `center` (a {lat,lng}) and return those
 * within `radiusKm`. `seedKey` makes the catalogue stable for that area.
 * Each restaurant gets a `distance` (km from center) attached.
 */
function getRestaurants(center, seedKey, radiusKm) {
  const rng = seededRandom(hashString(seedKey));
  const cosLat = Math.cos((center.lat * Math.PI) / 180) || 1;

  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    // Place restaurants radially, concentrated toward the centre (downtowns are
    // denser than the outskirts) so even a small search radius returns options.
    const angle = rng() * 2 * Math.PI;
    const distanceFromCentre = MAX_SPREAD_KM * Math.pow(rng(), 1.5);
    const lat = center.lat + (distanceFromCentre * Math.cos(angle)) / 111.32;
    const lng = center.lng + (distanceFromCentre * Math.sin(angle)) / (111.32 * cosLat);
    const cuisine = CUISINES[Math.floor(rng() * CUISINES.length)];
    const name = `${NAME_ADJ[Math.floor(rng() * NAME_ADJ.length)]} ${NAME_NOUN[Math.floor(rng() * NAME_NOUN.length)]}`;
    const priceLevel = 1 + Math.floor(rng() * 4);            // 1–4 ($ … $$$$)
    const rating = Math.round((3.5 + rng() * 1.4) * 10) / 10; // 3.5–4.9
    const reviewCount = Math.round(40 + rng() * 1500);
    const tables = makeTables(rng);
    const openMin = OPEN_CHOICES[Math.floor(rng() * OPEN_CHOICES.length)];
    const closeMin = CLOSE_CHOICES[Math.floor(rng() * CLOSE_CHOICES.length)];

    pool.push({
      id: `${seedKey}#${i}`,
      name,
      cuisine: cuisine.name,
      emoji: cuisine.emoji,
      lat, lng,
      priceLevel,
      rating,
      reviewCount,
      tables,
      openMin,
      closeMin,
      lastSeatMin: closeMin - DINING_MINUTES,
      maxSeats: Math.max(...tables.map((t) => t.seats)),
    });
  }

  return pool
    .map((r) => ({ ...r, distance: distanceKm(center, r) }))
    .filter((r) => r.distance <= radiusKm);
}

/* Deterministic table occupancy for a restaurant at a given date/time/table
 * size. Dinner peaks around 20:00, so tables are harder to get then. */
function bookedFraction(id, dateStr, slotMin, seats) {
  const rng = seededRandom(hashString(`${id}|${dateStr}|${slotMin}|${seats}`));
  const base = rng();                                        // 0–1 baseline demand
  const peak = Math.exp(-Math.pow((slotMin - 20 * 60) / 95, 2)); // bell curve at 20:00
  return Math.min(0.98, 0.10 + base * 0.45 + peak * 0.45);
}

/*
 * Is there a free table for `party` people at `slotMin` on `dateStr`?
 * Returns the smallest suitable table that has a seat free
 * ({ seats, freeCount }), or null if nothing fits / the kitchen is closed.
 */
function seatingAt(restaurant, dateStr, slotMin, party) {
  if (slotMin < restaurant.openMin || slotMin > restaurant.lastSeatMin) return null;

  const fits = restaurant.tables
    .filter((t) => t.seats >= party)
    .sort((a, b) => a.seats - b.seats); // seat the party at the smallest table that fits

  for (const group of fits) {
    const booked = Math.round(group.count * bookedFraction(restaurant.id, dateStr, slotMin, group.seats));
    if (booked < group.count) return { seats: group.seats, freeCount: group.count - booked };
  }
  return null;
}

/* Find the nearest known city to an arbitrary point (for labelling map picks). */
function nearestCity(point) {
  let best = null, bestDist = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(point, c);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return { city: best, distance: bestDist };
}

/* Time helpers: "HH:MM" <-> minutes since midnight. */
function timeToMin(str) {
  const [h, m] = String(str).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* Expose to the app. */
window.OtableData = {
  CITIES,
  getRestaurants,
  seatingAt,
  nearestCity,
  distanceKm,
  timeToMin,
  minToTime,
  DINNER_START_MIN,
  DINNER_END_MIN,
  SLOT_STEP,
};
