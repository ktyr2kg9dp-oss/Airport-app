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

/* Israeli cities O·Dine covers (name, country, latitude, longitude). */
const CITIES = [
  { name: "Ashdod",       country: "Israel",         lat: 31.8014, lng: 34.6435 },
  { name: "Ashkelon",     country: "Israel",         lat: 31.6688, lng: 34.5743 },
  { name: "Bat Yam",      country: "Israel",         lat: 32.0171, lng: 34.7457 },
  { name: "Bnei Brak",    country: "Israel",         lat: 32.0807, lng: 34.8338 },
  { name: "Holon",        country: "Israel",         lat: 32.0167, lng: 34.7792 },
  { name: "Kfar Saba",    country: "Israel",         lat: 32.1750, lng: 34.9070 },
  { name: "Modiin",       country: "Israel",         lat: 31.8983, lng: 35.0104 },
  { name: "Nahariya",     country: "Israel",         lat: 33.0059, lng: 35.0940 },
  { name: "Petah Tikva",  country: "Israel",         lat: 32.0840, lng: 34.8878 },
  { name: "Ra'anana",     country: "Israel",         lat: 32.1848, lng: 34.8713 },
  { name: "Rehovot",      country: "Israel",         lat: 31.8928, lng: 34.8113 },
  { name: "Tiberias",     country: "Israel",         lat: 32.7959, lng: 35.5300 },
  { name: "Zikhron Ya'akov", country: "Israel",      lat: 32.5719, lng: 34.9519 },
  { name: "Tel Aviv",     country: "Israel",         lat: 32.0853, lng: 34.7818 },
  { name: "Jerusalem",    country: "Israel",         lat: 31.7683, lng: 35.2137 },
  { name: "Haifa",        country: "Israel",         lat: 32.7940, lng: 34.9896 },
  { name: "Herzliya",     country: "Israel",         lat: 32.1663, lng: 34.8436 },
  { name: "Netanya",      country: "Israel",         lat: 32.3215, lng: 34.8532 },
  { name: "Ramat Gan",    country: "Israel",         lat: 32.0684, lng: 34.8248 },
  { name: "Rishon LeZion",country: "Israel",         lat: 31.9730, lng: 34.7925 },
  { name: "Akko",         country: "Israel",         lat: 32.9231, lng: 35.0818 },
  { name: "Caesarea",     country: "Israel",         lat: 32.5008, lng: 34.8925 },
  { name: "Be'er Sheva",  country: "Israel",         lat: 31.2518, lng: 34.7913 },
  { name: "Nazareth",     country: "Israel",         lat: 32.7021, lng: 35.2978 },
  { name: "Eilat",        country: "Israel",         lat: 29.5581, lng: 34.9482 },
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

/* Overall dinner window the UI offers (minutes since midnight). Israel dines
 * late, so the window runs to 23:30. */
const DINNER_START_MIN = 17 * 60;   // 17:00
const DINNER_END_MIN = 23 * 60 + 30; // 23:30
const SLOT_STEP = 30;                // reservations are on a 30-minute grid
const DINING_MINUTES = 90;           // a table is held ~90 minutes

/* For areas we don't have a curated catalogue for, restaurants are placed
 * within this radius of the chosen point and then filtered to the user's search
 * radius, so widening the search reveals more of the same restaurants rather
 * than reshuffling them. */
const MAX_SPREAD_KM = 30;
const POOL_SIZE = 130;

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

const OPEN_CHOICES = [17 * 60, 17 * 60 + 30, 18 * 60, 18 * 60 + 30, 19 * 60]; // 17:00–19:00
const CLOSE_CHOICES = [22 * 60, 22 * 60 + 30, 23 * 60, 23 * 60 + 30, 24 * 60]; // 22:00–24:00

/*
 * Real Israeli restaurants and the table-booking platform each one uses.
 * Fields: [name, cuisine, emoji, lat, lng, area, priceLevel, rating, reviews,
 *          provider?, bookingSlug?]. `provider` defaults to "ontopo"; other
 * supported providers include "ironbooking", "tabit" and "opentable". When a
 * `bookingSlug` is given the reserve link opens that exact booking page,
 * otherwise it opens the provider's search prefilled with the restaurant.
 * Coordinates are approximate (neighbourhood level). Availability + table mix
 * are generated deterministically from the name so results are stable.
 */
const ISRAEL_RAW = [
  // ---- Tel Aviv & Jaffa ----
  ["Taizu", "Asian", "🥢", 32.0632, 34.7716, "Tel Aviv", 4, 4.7, 4200],
  ["HaSalon", "Chef", "🍽️", 32.0736, 34.7838, "Tel Aviv", 4, 4.6, 2100],
  ["George & John", "Seafood", "🦞", 32.0508, 34.7530, "Jaffa", 4, 4.6, 1500],
  ["OCD", "Chef", "🍽️", 32.0489, 34.7554, "Jaffa", 4, 4.7, 900],
  ["Port Said", "Mediterranean", "🫒", 32.0637, 34.7702, "Tel Aviv", 2, 4.5, 5200],
  ["Miznon", "Israeli", "🥙", 32.0783, 34.7770, "Tel Aviv", 1, 4.5, 3800],
  ["Ha'achim", "Israeli", "🥙", 32.0730, 34.7803, "Tel Aviv", 2, 4.5, 4100],
  ["M25", "Grill", "🥩", 32.0684, 34.7690, "Tel Aviv", 2, 4.5, 2600],
  ["HaBasta", "Mediterranean", "🫒", 32.0670, 34.7686, "Tel Aviv", 3, 4.5, 1400],
  ["Onza", "Mediterranean", "🫒", 32.0544, 34.7585, "Jaffa", 3, 4.6, 1900],
  ["Shila", "Seafood", "🦞", 32.0885, 34.7730, "Tel Aviv", 3, 4.6, 3100],
  ["North Abraxas", "Mediterranean", "🫒", 32.0616, 34.7699, "Tel Aviv", 3, 4.5, 3300],
  ["Santa Katarina", "Mediterranean", "🫒", 32.0555, 34.7565, "Jaffa", 3, 4.5, 1200],
  ["Manta Ray", "Seafood", "🦞", 32.0574, 34.7580, "Tel Aviv", 3, 4.4, 5600],
  ["Kitchen Market", "Mediterranean", "🫒", 32.0968, 34.7745, "Tel Aviv", 3, 4.4, 2400],
  ["Herbert Samuel", "Chef", "🍽️", 32.0705, 34.7625, "Tel Aviv", 4, 4.6, 1800],
  ["Claro", "Mediterranean", "🫒", 32.0715, 34.7869, "Tel Aviv", 3, 4.5, 2900],
  ["Hotel Montefiore", "Vietnamese", "🍜", 32.0640, 34.7745, "Tel Aviv", 4, 4.5, 1600],
  ["The Old Man and the Sea", "Seafood", "🦞", 32.0510, 34.7510, "Jaffa", 2, 4.3, 7200],
  ["Ouzeria", "Greek", "🫒", 32.0596, 34.7768, "Tel Aviv", 2, 4.5, 1700],
  ["Hatraklin", "Grill", "🥩", 32.0645, 34.7690, "Tel Aviv", 3, 4.5, 1100],
  ["Coffee Bar", "Bistro", "🍷", 32.0577, 34.7859, "Tel Aviv", 3, 4.4, 2000],
  ["Yaffo-Tel Aviv", "Mediterranean", "🫒", 32.0692, 34.7802, "Tel Aviv", 3, 4.4, 2200],
  // ---- Jerusalem ----
  ["Machneyuda", "Chef", "🍽️", 31.7857, 35.2110, "Jerusalem", 4, 4.6, 4300],
  ["Anna Italian Cafe", "Italian", "🍝", 31.7817, 35.2180, "Jerusalem", 2, 4.5, 2600],
  ["Mona", "Mediterranean", "🫒", 31.7797, 35.2160, "Jerusalem", 3, 4.5, 1500],
  ["Chakra", "Mediterranean", "🫒", 31.7717, 35.2205, "Jerusalem", 3, 4.5, 1900],
  ["Rooftop", "Mediterranean", "🫒", 31.7770, 35.2245, "Jerusalem", 4, 4.5, 2100],
  ["Eucalyptus", "Israeli", "🥙", 31.7760, 35.2290, "Jerusalem", 3, 4.5, 1300],
  // ---- Haifa ----
  ["Fattoush", "Middle Eastern", "🧆", 32.8156, 34.9885, "Haifa", 2, 4.4, 2300],
  ["HaNamal 24", "Chef", "🍽️", 32.8210, 35.0010, "Haifa", 3, 4.4, 900],
  ["Eataliano Dalla Costa", "Italian", "🍝", 32.8205, 34.9935, "Haifa", 3, 4.5, 1400, "ironbooking", "eataliano-dalla-costa"],
  // ---- Akko (Acre) ----
  ["Uri Buri", "Seafood", "🦞", 32.9195, 35.0698, "Akko", 4, 4.7, 6100],
  ["El Marsa", "Seafood", "🦞", 32.9205, 35.0705, "Akko", 3, 4.5, 800],
  // ---- Caesarea ----
  ["Helena", "Seafood", "🦞", 32.5010, 34.8920, "Caesarea", 3, 4.4, 1700],
];

/* Turn a raw row into a full restaurant, deterministically filling the table
 * mix + opening hours from the restaurant's name. */
function buildIsraeliRestaurant(row) {
  const [name, cuisine, emoji, lat, lng, area, priceLevel, rating, reviewCount,
    provider = "ontopo", bookingSlug = null] = row;
  const rng = seededRandom(hashString(name));
  const tables = makeTables(rng);
  const openMin = OPEN_CHOICES[Math.floor(rng() * OPEN_CHOICES.length)];
  const closeMin = CLOSE_CHOICES[Math.floor(rng() * CLOSE_CHOICES.length)];
  return {
    id: `il:${name}`,
    name, cuisine, emoji, lat, lng, area,
    priceLevel, rating, reviewCount,
    tables, openMin, closeMin,
    lastSeatMin: closeMin - DINING_MINUTES,
    maxSeats: Math.max(...tables.map((t) => t.seats)),
    provider, bookingSlug,
  };
}

const ISRAEL_RESTAURANTS = ISRAEL_RAW.map(buildIsraeliRestaurant);

/* Rough bounding box for Israel — inside it we only ever serve the real
 * Ontopo-listed restaurants above (never the synthetic generator). */
function inIsrael(point) {
  return point.lat >= 29.3 && point.lat <= 33.4 && point.lng >= 34.2 && point.lng <= 35.95;
}

/*
 * Restaurants around `center` (a {lat,lng}) within `radiusKm`. In Israel this
 * returns the real Ontopo-listed restaurants; elsewhere it falls back to a
 * deterministic synthetic catalogue (stable for a given `seedKey`).
 * Each restaurant gets a `distance` (km from center) attached.
 */
function getRestaurants(center, seedKey, radiusKm) {
  const curated = ISRAEL_RESTAURANTS
    .map((r) => ({ ...r, distance: distanceKm(center, r) }))
    .filter((r) => r.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  // Israel is real-data only; anywhere else uses the synthetic generator.
  if (curated.length || inIsrael(center)) return curated;
  return generateRestaurants(center, seedKey, radiusKm);
}

/* Synthetic fallback catalogue for areas we don't curate (e.g. Paris). */
function generateRestaurants(center, seedKey, radiusKm) {
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
  inIsrael,
  distanceKm,
  timeToMin,
  minToTime,
  DINNER_START_MIN,
  DINNER_END_MIN,
  SLOT_STEP,
};
