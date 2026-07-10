# O·Dine — Restaurant Seats 🍽️

Find every restaurant **in a given area** that has an **available table** for
your **party size** at your **dinner time** — either an exact time or a range —
and book it on **[Ontopo](https://ontopo.com/en/il)**.

Pick a **city** or drop a **point on the map**, say **how many people** and
**when** you want to eat, and O·Dine lists the restaurants with a free table
that seats your whole party, with the exact seatings that are open.

No build step, no API keys. Open `index.html` for a quick look, or run the
included server.

## How it works

1. **Where** — type any city (autocomplete) **or click anywhere on the map** to
   search around that exact spot. Drag the pin to fine-tune, and set the
   **search area** radius (**1–50 km**).
2. **Who** — enter the **number of diners**. Only restaurants with a table that
   seats the whole party are shown (a party of 3 is offered a 4-top, etc.).
3. **When** — pick a **date**, then either an **exact dinner time** or a **time
   range** (from → to). For a range, O·Dine lists every 30-minute seating that's
   free within it. The window runs late (17:00–23:30) to match Israeli dining.

Each result shows the restaurant's cuisine, rating, price level, area and
distance, the free seating time(s), and a **Book on Ontopo** link pre-filled
with the restaurant, party size, date and time. A map plots the matches as
numbered pins around your search area.

## Restaurants & data

- **Israel** — O·Dine serves a **curated list of real restaurants** that take
  reservations on Ontopo (Taizu, Machneyuda, Uri Buri, Port Said, George & John,
  and more across Tel Aviv, Jaffa, Jerusalem, Haifa, Akko and Caesarea), with
  their real names, cuisines and locations. **Reserve links go to Ontopo.**
- **Elsewhere** — for areas we don't curate yet, O·Dine falls back to a
  deterministic synthetic catalogue so the app still demonstrates end-to-end.

Table availability is **simulated** for the demo (see below). To wire up **live**
availability from Ontopo, see "Connecting a live reservations API".

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
logo.jpg     # O·Dine — Restaurant Seats logo (shown in the header)
data.js      # cities + real Israeli restaurants + table-availability engine
app.js       # UI logic: autocomplete, map picker, availability search, rendering
server.js    # tiny static file server
```

## How availability is modelled

Each restaurant has a **table mix** by size (2-, 4-, 6-, 8-, and occasionally
10-/12-seat tables) and **dinner opening hours**. For a requested date/time and
party size, the engine finds the **smallest table that fits the party** and
checks whether one is **free** at that seating. Occupancy is derived
deterministically from the restaurant, date and time and **peaks around 20:00**,
so prime-time tables are harder to get — just like real life. Results are stable
between reloads for the same area/date.

## Connecting a live reservations API

To use **live Ontopo availability** instead of the simulated engine, replace the
two functions the app depends on in `data.js`:

- **`getRestaurants(center, seedKey, radiusKm)`** → an Ontopo area/discovery
  search for restaurants near the point, reading each place's name, location,
  cuisine, rating and price level.
- **`seatingAt(restaurant, dateStr, slotMin, party)`** → an Ontopo availability
  lookup for the given restaurant, date, time and party size.

Keep the returned object shapes (`{ name, lat, lng, cuisine, rating,
priceLevel, area, distance, ontopo }` and `{ seats, freeCount }`) and the rest
of the app works unchanged. Route any keyed API calls through `server.js` so
your key never reaches the browser.

## Bundled cities

Tel Aviv · Jaffa · Jerusalem · Haifa · Akko · Caesarea · Herzliya · Netanya ·
and ~45 more world cities. Restaurants are generated (or, in Israel, curated)
around whichever city or map point you choose. Extend the `CITIES` list — and,
for Israel, the `ISRAEL_RAW` list — in `data.js` to add more.
