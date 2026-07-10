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
  if (!cityName) return [];
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
      cleanliness: Math.round(78 + rng() * 21),           // 78 – 99 % positive
      service: Math.round(75 + rng() * 24),               // 75 – 99 % positive
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
/* ------------------------------------------------------------------ */
/* Flights: airports, airlines, alliances                             */
/* ------------------------------------------------------------------ */

/* Major world airports (IATA code, airport name, city, country). */
const AIRPORTS = [
  { code: "JFK", name: "John F. Kennedy Intl", city: "New York", country: "USA" },
  { code: "LGA", name: "LaGuardia", city: "New York", country: "USA" },
  { code: "EWR", name: "Newark Liberty", city: "New York", country: "USA" },
  { code: "LAX", name: "Los Angeles Intl", city: "Los Angeles", country: "USA" },
  { code: "ORD", name: "O'Hare Intl", city: "Chicago", country: "USA" },
  { code: "SFO", name: "San Francisco Intl", city: "San Francisco", country: "USA" },
  { code: "MIA", name: "Miami Intl", city: "Miami", country: "USA" },
  { code: "BOS", name: "Logan Intl", city: "Boston", country: "USA" },
  { code: "SEA", name: "Seattle-Tacoma", city: "Seattle", country: "USA" },
  { code: "ATL", name: "Hartsfield-Jackson", city: "Atlanta", country: "USA" },
  { code: "DFW", name: "Dallas/Fort Worth", city: "Dallas", country: "USA" },
  { code: "LAS", name: "Harry Reid Intl", city: "Las Vegas", country: "USA" },
  { code: "IAD", name: "Washington Dulles", city: "Washington", country: "USA" },
  { code: "YYZ", name: "Toronto Pearson", city: "Toronto", country: "Canada" },
  { code: "YVR", name: "Vancouver Intl", city: "Vancouver", country: "Canada" },
  { code: "MEX", name: "Mexico City Intl", city: "Mexico City", country: "Mexico" },
  { code: "GRU", name: "Guarulhos", city: "São Paulo", country: "Brazil" },
  { code: "GIG", name: "Galeão", city: "Rio de Janeiro", country: "Brazil" },
  { code: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "Argentina" },
  { code: "LHR", name: "Heathrow", city: "London", country: "UK" },
  { code: "LGW", name: "Gatwick", city: "London", country: "UK" },
  { code: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France" },
  { code: "ORY", name: "Orly", city: "Paris", country: "France" },
  { code: "AMS", name: "Schiphol", city: "Amsterdam", country: "Netherlands" },
  { code: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Germany" },
  { code: "MUC", name: "Munich", city: "Munich", country: "Germany" },
  { code: "MAD", name: "Barajas", city: "Madrid", country: "Spain" },
  { code: "BCN", name: "El Prat", city: "Barcelona", country: "Spain" },
  { code: "FCO", name: "Fiumicino", city: "Rome", country: "Italy" },
  { code: "MXP", name: "Malpensa", city: "Milan", country: "Italy" },
  { code: "LIS", name: "Humberto Delgado", city: "Lisbon", country: "Portugal" },
  { code: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland" },
  { code: "VIE", name: "Vienna", city: "Vienna", country: "Austria" },
  { code: "CPH", name: "Copenhagen", city: "Copenhagen", country: "Denmark" },
  { code: "ARN", name: "Arlanda", city: "Stockholm", country: "Sweden" },
  { code: "OSL", name: "Gardermoen", city: "Oslo", country: "Norway" },
  { code: "HEL", name: "Helsinki-Vantaa", city: "Helsinki", country: "Finland" },
  { code: "DUB", name: "Dublin", city: "Dublin", country: "Ireland" },
  { code: "BRU", name: "Brussels", city: "Brussels", country: "Belgium" },
  { code: "ATH", name: "Eleftherios Venizelos", city: "Athens", country: "Greece" },
  { code: "IST", name: "Istanbul", city: "Istanbul", country: "Turkey" },
  { code: "DXB", name: "Dubai Intl", city: "Dubai", country: "UAE" },
  { code: "AUH", name: "Abu Dhabi Intl", city: "Abu Dhabi", country: "UAE" },
  { code: "DOH", name: "Hamad Intl", city: "Doha", country: "Qatar" },
  { code: "TLV", name: "Ben Gurion", city: "Tel Aviv", country: "Israel" },
  { code: "CAI", name: "Cairo Intl", city: "Cairo", country: "Egypt" },
  { code: "JNB", name: "O.R. Tambo", city: "Johannesburg", country: "South Africa" },
  { code: "CPT", name: "Cape Town Intl", city: "Cape Town", country: "South Africa" },
  { code: "SIN", name: "Changi", city: "Singapore", country: "Singapore" },
  { code: "HKG", name: "Hong Kong Intl", city: "Hong Kong", country: "China" },
  { code: "NRT", name: "Narita", city: "Tokyo", country: "Japan" },
  { code: "HND", name: "Haneda", city: "Tokyo", country: "Japan" },
  { code: "ICN", name: "Incheon", city: "Seoul", country: "South Korea" },
  { code: "PEK", name: "Beijing Capital", city: "Beijing", country: "China" },
  { code: "PVG", name: "Pudong", city: "Shanghai", country: "China" },
  { code: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "Thailand" },
  { code: "KUL", name: "Kuala Lumpur Intl", city: "Kuala Lumpur", country: "Malaysia" },
  { code: "DEL", name: "Indira Gandhi Intl", city: "Delhi", country: "India" },
  { code: "BOM", name: "Chhatrapati Shivaji", city: "Mumbai", country: "India" },
  { code: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australia" },
  { code: "MEL", name: "Melbourne", city: "Melbourne", country: "Australia" },
  { code: "AKL", name: "Auckland", city: "Auckland", country: "New Zealand" },
];

/* Airlines (name, IATA code, alliance or null). */
const AIRLINES = [
  { name: "United Airlines", code: "UA", alliance: "Star Alliance" },
  { name: "Lufthansa", code: "LH", alliance: "Star Alliance" },
  { name: "Air Canada", code: "AC", alliance: "Star Alliance" },
  { name: "Singapore Airlines", code: "SQ", alliance: "Star Alliance" },
  { name: "Turkish Airlines", code: "TK", alliance: "Star Alliance" },
  { name: "ANA", code: "NH", alliance: "Star Alliance" },
  { name: "Swiss", code: "LX", alliance: "Star Alliance" },
  { name: "Austrian Airlines", code: "OS", alliance: "Star Alliance" },
  { name: "Thai Airways", code: "TG", alliance: "Star Alliance" },
  { name: "Ethiopian Airlines", code: "ET", alliance: "Star Alliance" },
  { name: "Avianca", code: "AV", alliance: "Star Alliance" },
  { name: "Copa Airlines", code: "CM", alliance: "Star Alliance" },
  { name: "SAS", code: "SK", alliance: "Star Alliance" },
  { name: "TAP Air Portugal", code: "TP", alliance: "Star Alliance" },
  { name: "Air New Zealand", code: "NZ", alliance: "Star Alliance" },
  { name: "Asiana Airlines", code: "OZ", alliance: "Star Alliance" },
  { name: "EVA Air", code: "BR", alliance: "Star Alliance" },
  { name: "Brussels Airlines", code: "SN", alliance: "Star Alliance" },
  { name: "Delta Air Lines", code: "DL", alliance: "SkyTeam" },
  { name: "Air France", code: "AF", alliance: "SkyTeam" },
  { name: "KLM", code: "KL", alliance: "SkyTeam" },
  { name: "Aeroméxico", code: "AM", alliance: "SkyTeam" },
  { name: "Korean Air", code: "KE", alliance: "SkyTeam" },
  { name: "ITA Airways", code: "AZ", alliance: "SkyTeam" },
  { name: "China Eastern", code: "MU", alliance: "SkyTeam" },
  { name: "China Airlines", code: "CI", alliance: "SkyTeam" },
  { name: "Kenya Airways", code: "KQ", alliance: "SkyTeam" },
  { name: "Saudia", code: "SV", alliance: "SkyTeam" },
  { name: "Vietnam Airlines", code: "VN", alliance: "SkyTeam" },
  { name: "Garuda Indonesia", code: "GA", alliance: "SkyTeam" },
  { name: "Virgin Atlantic", code: "VS", alliance: "SkyTeam" },
  { name: "American Airlines", code: "AA", alliance: "Oneworld" },
  { name: "British Airways", code: "BA", alliance: "Oneworld" },
  { name: "Qantas", code: "QF", alliance: "Oneworld" },
  { name: "Cathay Pacific", code: "CX", alliance: "Oneworld" },
  { name: "Qatar Airways", code: "QR", alliance: "Oneworld" },
  { name: "Iberia", code: "IB", alliance: "Oneworld" },
  { name: "Japan Airlines", code: "JL", alliance: "Oneworld" },
  { name: "Finnair", code: "AY", alliance: "Oneworld" },
  { name: "Malaysia Airlines", code: "MH", alliance: "Oneworld" },
  { name: "Royal Jordanian", code: "RJ", alliance: "Oneworld" },
  { name: "Alaska Airlines", code: "AS", alliance: "Oneworld" },
  { name: "Emirates", code: "EK", alliance: null },
  { name: "Etihad Airways", code: "EY", alliance: null },
  { name: "JetBlue", code: "B6", alliance: null },
  { name: "Southwest Airlines", code: "WN", alliance: null },
  { name: "Ryanair", code: "FR", alliance: null },
  { name: "easyJet", code: "U2", alliance: null },
  { name: "Wizz Air", code: "W6", alliance: null },
  { name: "Norwegian", code: "DY", alliance: null },
  { name: "IndiGo", code: "6E", alliance: null },
  { name: "El Al", code: "LY", alliance: null },
];

const ALLIANCES = ["Star Alliance", "SkyTeam", "Oneworld"];

window.OflightsData = {
  CITIES, POIS, getHotelsForCity, distanceKm,
  AIRPORTS, AIRLINES, ALLIANCES,
};
