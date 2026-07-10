/*
 * Oflights bundled dataset
 * ------------------------------------------------------------------
 * This file provides the city + point-of-interest data and generates a
 * catalogue of hotels for each city. It is intentionally self-contained so
 * the app runs with zero setup / no API keys.
 *
 * To use the LIVE Google data instead (all cities & POIs found in Google),
 * see README.md -> "Connecting the Google Places API". The rest of the app
 * only depends on the shape of the objects returned here, so it is a drop-in
 * replacement.
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
];

/*
 * Points of interest per city: geographic sights, museums, landmarks, etc.
 * type is one of: landmark, museum, park, geographic, religious, entertainment.
 */
const POIS = {
  Paris: [
    { name: "Eiffel Tower",           type: "landmark",   lat: 48.8584, lng: 2.2945 },
    { name: "Louvre Museum",          type: "museum",     lat: 48.8606, lng: 2.3376 },
    { name: "Notre-Dame Cathedral",   type: "religious",  lat: 48.8530, lng: 2.3499 },
    { name: "Arc de Triomphe",        type: "landmark",   lat: 48.8738, lng: 2.2950 },
    { name: "Montmartre",             type: "geographic", lat: 48.8867, lng: 2.3431 },
  ],
  London: [
    { name: "Big Ben",                type: "landmark",   lat: 51.5007, lng: -0.1246 },
    { name: "British Museum",         type: "museum",     lat: 51.5194, lng: -0.1270 },
    { name: "Tower of London",        type: "landmark",   lat: 51.5081, lng: -0.0759 },
    { name: "Hyde Park",              type: "park",       lat: 51.5073, lng: -0.1657 },
    { name: "London Eye",            type: "entertainment", lat: 51.5033, lng: -0.1195 },
  ],
  "New York": [
    { name: "Statue of Liberty",      type: "landmark",   lat: 40.6892, lng: -74.0445 },
    { name: "Central Park",           type: "park",       lat: 40.7829, lng: -73.9654 },
    { name: "Times Square",           type: "landmark",   lat: 40.7580, lng: -73.9855 },
    { name: "Metropolitan Museum",    type: "museum",     lat: 40.7794, lng: -73.9632 },
    { name: "Empire State Building",  type: "landmark",   lat: 40.7484, lng: -73.9857 },
  ],
  Tokyo: [
    { name: "Senso-ji Temple",        type: "religious",  lat: 35.7148, lng: 139.7967 },
    { name: "Tokyo Tower",            type: "landmark",   lat: 35.6586, lng: 139.7454 },
    { name: "Shibuya Crossing",       type: "landmark",   lat: 35.6595, lng: 139.7005 },
    { name: "Meiji Shrine",           type: "religious",  lat: 35.6764, lng: 139.6993 },
    { name: "Ueno Park",              type: "park",       lat: 35.7156, lng: 139.7745 },
  ],
  Rome: [
    { name: "Colosseum",              type: "landmark",   lat: 41.8902, lng: 12.4922 },
    { name: "Vatican Museums",        type: "museum",     lat: 41.9065, lng: 12.4536 },
    { name: "Trevi Fountain",         type: "landmark",   lat: 41.9009, lng: 12.4833 },
    { name: "Pantheon",               type: "landmark",   lat: 41.8986, lng: 12.4769 },
    { name: "Roman Forum",            type: "geographic", lat: 41.8925, lng: 12.4853 },
  ],
  Barcelona: [
    { name: "Sagrada Familia",        type: "religious",  lat: 41.4036, lng: 2.1744 },
    { name: "Park Güell",             type: "park",       lat: 41.4145, lng: 2.1527 },
    { name: "La Rambla",              type: "geographic", lat: 41.3797, lng: 2.1746 },
    { name: "Casa Batlló",            type: "landmark",   lat: 41.3916, lng: 2.1650 },
    { name: "Gothic Quarter",         type: "geographic", lat: 41.3833, lng: 2.1777 },
  ],
  Amsterdam: [
    { name: "Rijksmuseum",            type: "museum",     lat: 52.3600, lng: 4.8852 },
    { name: "Anne Frank House",       type: "museum",     lat: 52.3752, lng: 4.8840 },
    { name: "Van Gogh Museum",        type: "museum",     lat: 52.3584, lng: 4.8811 },
    { name: "Vondelpark",             type: "park",       lat: 52.3579, lng: 4.8686 },
    { name: "Dam Square",             type: "geographic", lat: 52.3731, lng: 4.8926 },
  ],
  Dubai: [
    { name: "Burj Khalifa",           type: "landmark",   lat: 25.1972, lng: 55.2744 },
    { name: "Dubai Mall",           type: "entertainment", lat: 25.1985, lng: 55.2796 },
    { name: "Palm Jumeirah",          type: "geographic", lat: 25.1122, lng: 55.1390 },
    { name: "Dubai Marina",           type: "geographic", lat: 25.0805, lng: 55.1403 },
    { name: "Burj Al Arab",           type: "landmark",   lat: 25.1412, lng: 55.1853 },
  ],
  Singapore: [
    { name: "Marina Bay Sands",       type: "landmark",   lat: 1.2834,  lng: 103.8607 },
    { name: "Gardens by the Bay",     type: "park",       lat: 1.2816,  lng: 103.8636 },
    { name: "Sentosa Island",       type: "entertainment", lat: 1.2494, lng: 103.8303 },
    { name: "Merlion Park",           type: "landmark",   lat: 1.2868,  lng: 103.8545 },
    { name: "Chinatown",              type: "geographic", lat: 1.2833,  lng: 103.8433 },
  ],
  Sydney: [
    { name: "Sydney Opera House",     type: "landmark",   lat: -33.8568, lng: 151.2153 },
    { name: "Harbour Bridge",         type: "landmark",   lat: -33.8523, lng: 151.2108 },
    { name: "Bondi Beach",            type: "geographic", lat: -33.8908, lng: 151.2743 },
    { name: "Darling Harbour",      type: "entertainment", lat: -33.8748, lng: 151.1987 },
    { name: "Royal Botanic Garden",   type: "park",       lat: -33.8641, lng: 151.2165 },
  ],
  Istanbul: [
    { name: "Hagia Sophia",           type: "religious",  lat: 41.0086, lng: 28.9802 },
    { name: "Blue Mosque",            type: "religious",  lat: 41.0054, lng: 28.9768 },
    { name: "Topkapi Palace",         type: "museum",     lat: 41.0115, lng: 28.9834 },
    { name: "Grand Bazaar",           type: "geographic", lat: 41.0106, lng: 28.9680 },
    { name: "Galata Tower",           type: "landmark",   lat: 41.0256, lng: 28.9744 },
  ],
  "San Francisco": [
    { name: "Golden Gate Bridge",     type: "landmark",   lat: 37.8199, lng: -122.4783 },
    { name: "Alcatraz Island",        type: "landmark",   lat: 37.8267, lng: -122.4230 },
    { name: "Fisherman's Wharf",    type: "entertainment", lat: 37.8080, lng: -122.4177 },
    { name: "Golden Gate Park",       type: "park",       lat: 37.7694, lng: -122.4862 },
    { name: "Ferry Building",         type: "landmark",   lat: 37.7955, lng: -122.3937 },
  ],
};

/* Small, deterministic pseudo-random generator (mulberry32) so the hotel
 * catalogue is stable between reloads for the same city. */
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

const HOTEL_BRANDS = [
  "Grand", "Royal", "Central", "Park", "Riverside", "Plaza", "Boutique",
  "Skyline", "Garden", "Metropolitan", "Comfort", "Heritage", "Luxe", "Urban",
];
const HOTEL_TYPES = ["Hotel", "Suites", "Inn", "Residence", "Palace", "Lodge"];

/*
 * Build a catalogue of hotels for a city. Each hotel gets a stable coordinate
 * near the city centre, a nightly price, a review score and a review count.
 */
function getHotelsForCity(cityName) {
  const city = CITIES.find((c) => c.name.toLowerCase() === cityName.toLowerCase());
  if (!city) return [];

  const rng = seededRandom(hashString(city.name));
  const count = 14; // generate a pool; the app returns the top 5
  const hotels = [];

  for (let i = 0; i < count; i++) {
    // Spread hotels within roughly a 5 km box around the city centre.
    const dLat = (rng() - 0.5) * 0.09;
    const dLng = (rng() - 0.5) * 0.09;
    const brand = HOTEL_BRANDS[Math.floor(rng() * HOTEL_BRANDS.length)];
    const type = HOTEL_TYPES[Math.floor(rng() * HOTEL_TYPES.length)];

    hotels.push({
      id: `${city.name}-${i}`,
      name: `${brand} ${city.name} ${type}`,
      lat: city.lat + dLat,
      lng: city.lng + dLng,
      pricePerNight: Math.round(70 + rng() * 480),        // 70 – 550
      reviewScore: Math.round((6.5 + rng() * 3.4) * 10) / 10, // 6.5 – 9.9
      reviewCount: Math.round(80 + rng() * 4200),
    });
  }
  return hotels;
}

/* Haversine distance in kilometres between two lat/lng points. */
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

/* Expose to the app. */
window.OflightsData = { CITIES, POIS, getHotelsForCity, distanceKm };
