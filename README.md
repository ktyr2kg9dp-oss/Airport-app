# Otable 🍽️

Find every restaurant **in a given area** that has an **available table** for
your **party size** at your **dinner time** — either an exact time or a range.

Pick a **city** or drop a **point on the map**, say **how many people** and
**when** you want to eat, and Otable lists the restaurants with a free table
that seats your whole party, with the exact seatings that are open.

No build step, no API keys. Open `index.html` for a quick look, or run the
included server.

## How it works

1. **Where** — type any city (autocomplete) **or click anywhere on the map** to
   search around that exact spot. Drag the pin to fine-tune, and set the
   **search area** radius (0.2–7 km).
2. **Who** — enter the **number of diners**. Only restaurants with a table that
   seats the whole party are shown (a party of 3 is offered a 4-top, etc.).
3. **When** — pick a **date**, then either an **exact dinner time** or a **time
   range** (from → to). For a range, Otable lists every 30-minute seating that's
   free within it.

The results list shows each matching restaurant with its cuisine, rating, price
level and distance, the free seating time(s), and a **Reserve** link that opens
[OpenTable](https://www.opentable.com/) pre-filled with the restaurant, party
size, date and time. A map plots the matches as numbered pins around your search
area.

## Running it

```bash
# Serve the app locally
node server.js            # http://localhost:3000

# Or just open the file directly
open index.html           # macOS (xdg-open on Linux / double-click on Windows)
```

> Requires Node 18+ to run the server. The map uses **Leaflet +
> OpenStreetMap** (free, no key); when there's no internet connection the app
> falls back to city search and shows a short message instead of the map.

## Project structure

```
index.html   # markup: area (city + map), party size, date, time mode, results
styles.css   # styling / responsive layout
data.js      # bundled cities + restaurant generator + table-availability engine
app.js       # UI logic: autocomplete, map picker, availability search, rendering
server.js    # tiny static file server
```

## How availability is modelled

Each restaurant is generated deterministically for its area (so results are
stable between reloads) with:

- a **table mix** by size (2-, 4-, 6-, 8-, and occasionally 10-/12-seat tables),
- **opening hours** for dinner service, and
- a **cuisine, rating, review count and price level**.

For a requested date/time and party size, the engine finds the **smallest table
that fits the party** and checks whether one is **free** at that seating.
Occupancy is derived deterministically from the restaurant, date and time and
**peaks around 20:00**, so prime-time tables are harder to get — just like real
life.

## Connecting a live reservations API

To use real restaurants and live availability instead of the bundled data,
replace the two functions the app depends on in `data.js`:

- **`getRestaurants(center, seedKey, radiusKm)`** → a nearby-search for
  restaurants (e.g. Google Places Nearby Search with `type=restaurant`), reading
  each place's `name`, `geometry.location`, `rating`, `price_level`, etc.
- **`seatingAt(restaurant, dateStr, slotMin, party)`** → a call to a reservation
  provider's availability API (e.g. OpenTable/Resy partner APIs) for the given
  restaurant, date, time and party size.

Keep the returned object shapes (`{ name, lat, lng, cuisine, rating,
priceLevel, distance }` and `{ seats, freeCount }`) and the rest of the app
works unchanged. Route any keyed API calls through `server.js` so your key never
reaches the browser.

## Bundled cities

Paris · London · New York · Tokyo · Rome · Barcelona · Amsterdam · Dubai ·
Singapore · Sydney · Istanbul · San Francisco · and ~40 more. Restaurants are
generated around whichever city or map point you choose. Extend the `CITIES`
list in `data.js` to add more named cities (the map picker already works
anywhere on Earth).
