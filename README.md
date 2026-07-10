# Oflights ✈️🏨

A lightweight web app to **locate flights and hotels**. Search hotels by
**city** and **point of interest**, pick your **check-in / check-out** dates,
and get the **top 5 hotels** ranked by your chosen priorities.

No build dependencies. Open `index.html` for a quick look with sample data, or
run the included server to get **real live prices on every search**.

## Live prices (real Booking.com / Expedia / Hotels.com rates)

Every hotel search can pull **real, current prices** and show you the cheapest,
automatically — no manual looking. This uses the [SerpApi Google Hotels API](https://serpapi.com/google-hotels-api),
which aggregates live rates across Booking.com, Expedia, Hotels.com and more.
Your API key stays on the server and never reaches the browser.

**One-time setup (~3 minutes):**

1. Create a free key at <https://serpapi.com/users/sign_up> and copy it from
   <https://serpapi.com/manage-api-key>.
2. Start the app with your key:

   ```bash
   SERPAPI_KEY=your_key_here node server.js
   # then open http://localhost:3000
   ```

That's it. From then on **every search** fetches live prices, tags the results
**● Live prices**, and ranks the three cheapest booking options per hotel with
working links straight to each provider.

If `SERPAPI_KEY` isn't set (or you just open `index.html` directly), the app
falls back to bundled **sample** prices and says so — nothing breaks.

> Requires Node 18+ (uses the built-in `fetch`). No `npm install` needed.

## Features

### Flight / Hotel selector
A single toggle at the top switches the whole search between **Hotel** and
**Flight** mode.

### Hotel search
When **Hotel** is selected the following inputs are active:

| Button / field       | What it does |
|----------------------|--------------|
| **City**             | Type a city; an autocomplete lists matching cities (bundled dataset today, all Google cities once the API is connected). |
| **Point of interest**| Type a landmark, museum, park, geographic sight, etc. Suggestions are scoped to the chosen city. |
| **Check in**         | Date picker for the check-in day. |
| **Check out**        | Date picker for the check-out day (used to compute nights & total price). |

### Ranking criteria
Choose **up to 3 criteria in priority order** — the order you tick them is the
priority (1st = most important):

- 💰 **Price per night** (lowest first)
- ⭐ **Review score** (highest first)
- 📍 **Distance from point of interest** (nearest first)
- 🧼 **Cleanliness reviews** (highest first)
- 🛎️ **Service reviews** (highest first)

Cleanliness and service scores come from Google Hotels' review-sentiment
breakdown (shown as "% positive"). When Google doesn't report them for a hotel,
that hotel simply omits those badges. You can also cap results by a **maximum
distance** from the point of interest (0–99 km, decimals allowed).

The app normalises each metric to a 0–1 score, weights them by priority
(3 / 2 / 1), and returns the **top 5 hotels**.

### Reservation options
Every hotel result lists **three ways to reserve it** — one per booking
provider (Booking.com, Expedia, Hotels.com). Each option shows its own
**per-night and total price** and a **Reserve** link. Options are sorted
cheapest-first and the lowest is tagged **Best price**; the card headline shows
the resulting "from" price.

With **live prices** enabled (see above) these are the **real current rates**
each provider is charging, pulled per search. Without a key, they're realistic
sample prices so you can see how it works.

> Selecting **Distance from point of interest** requires a point of interest to
> be chosen; the app will prompt you if it's missing.

### Flight search (companion)
Flight mode estimates distance, flight time and a price between two cities.

## Running it

```bash
# Recommended: run the server for LIVE prices (see "Live prices" above)
SERPAPI_KEY=your_key_here node server.js   # http://localhost:3000

# Or run the server without a key to preview with sample prices
node server.js

# Or just open the file (sample prices only, no server)
open index.html            # macOS  (xdg-open on Linux / double-click on Windows)
```

## Project structure

```
index.html   # markup: mode switch, hotel & flight forms, results container
styles.css   # styling / responsive layout
data.js      # bundled cities + points of interest, hotel generator, geo helpers
app.js       # UI logic: autocomplete, criteria ordering, live fetch, ranking, rendering
server.js    # backend: serves the app + /api/search live-price proxy (SerpApi)
```

### Always-on / deploy
`node server.js` is per-machine. To have live prices available anywhere without
keeping a terminal open, deploy `server.js` to any Node host (Render, Railway,
Fly.io, a VPS) and set `SERPAPI_KEY` as an environment variable there.

## How ranking works

For each selected criterion the value is normalised across the candidate
hotels so the best hotel scores `1` and the worst scores `0`
(price and distance are inverted because lower is better). Each normalised
score is multiplied by a priority weight (1st pick ×3, 2nd ×2, 3rd ×1) and
summed. Hotels are sorted by the combined score and the top 5 are shown.

## Connecting the Google Places API

The task calls for "all cities that can be found in Google" and points of
interest "that are listed in Google." To keep the app runnable offline it ships
with a curated dataset in `data.js`. To use live Google data instead, replace
the three exported functions with Google Places calls — the rest of the app is
unchanged because it only depends on their return shapes:

1. Get a Google Maps Platform API key and enable the **Places API**.
2. In `data.js`, swap the implementations of:
   - **City autocomplete** → [Place Autocomplete](https://developers.google.com/maps/documentation/places/web-service/autocomplete) with `types=(cities)`.
   - **Point-of-interest autocomplete** → Place Autocomplete with `types=establishment|tourist_attraction`, biased to the selected city via `locationbias`.
   - **`getHotelsForCity`** → [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/search-nearby) with `type=lodging`, reading `price_level`, `rating`, `user_ratings_total`, and `geometry.location` for the distance calculation.
3. Keep the returned object fields (`name`, `lat`, `lng`, `pricePerNight`,
   `reviewScore`, `reviewCount`) so `app.js` continues to work as-is.

> Note: Places API calls should be proxied through a small backend so your API
> key is never exposed in the browser.

## Bundled cities

Paris · London · New York · Tokyo · Rome · Barcelona · Amsterdam · Dubai ·
Singapore · Sydney · Istanbul · San Francisco (each with five points of
interest). Extend the `CITIES` and `POIS` structures in `data.js` to add more.
