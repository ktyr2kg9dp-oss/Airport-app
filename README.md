# Oflights ✈️🏨

A lightweight web app to **locate flights and hotels**. Search hotels by
**city** and **point of interest**, pick your **check-in / check-out** dates,
and get the **top 5 hotels** ranked by your chosen priorities.

No build step, no dependencies — just open `index.html` in a browser.

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

The app normalises each metric to a 0–1 score, weights them by priority
(3 / 2 / 1), and returns the **top 5 hotels**.

> Selecting **Distance from point of interest** requires a point of interest to
> be chosen; the app will prompt you if it's missing.

### Flight search (companion)
Flight mode estimates distance, flight time and a price between two cities.

## Running it

Because the app is fully static, you can either open the file directly or serve
it locally:

```bash
# Option A: just open it
open index.html            # macOS   (use `xdg-open` on Linux / double-click on Windows)

# Option B: serve it (recommended, avoids any file:// quirks)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
index.html   # markup: mode switch, hotel & flight forms, results container
styles.css   # styling / responsive layout
data.js      # bundled cities + points of interest, hotel generator, geo helpers
app.js       # UI logic: autocomplete, criteria ordering, ranking, rendering
```

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
