# O·Dine — Restaurant Seats 🍽️ (Israel)

Find restaurants **in Israel**, in a given area, that are **open for your dinner
time**, for your **party size** — an exact time or a range — and reserve a table
on the restaurant's own platform (Ontopo, Ironbooking, Google, …).

Pick a **city** or drop a **point on the map**, choose **how many people** and
**when**, and O·Dine lists real restaurants near you that are open then.

## Real data (Google Places)

With a **Google Places API key**, every search returns **real restaurants** near
the point — actual names, ratings, price levels, addresses and opening hours —
filtered to those **open at your selected time**. The key stays on the server
and never reaches the browser.

**One-time setup (~2 minutes):**

1. In the [Google Cloud console](https://console.cloud.google.com/) create a
   project, enable the **Places API (New)**, and create an **API key**
   (Google's free monthly credit covers plenty of searches).
2. Start the app with your key:

   ```bash
   GOOGLE_PLACES_KEY=your_key_here node server.js
   # then open http://localhost:3000
   ```

From then on every search hits `/api/restaurants`, which calls Google Places
Nearby Search and returns real restaurants tagged **● Live · Google**.

**Without a key** (or if you just open `index.html`), O·Dine falls back to a
small **curated sample** of well-known Israeli restaurants with *simulated*
availability, clearly tagged **◐ Sample data** — nothing breaks.

> Requires Node 18+ (uses the built-in `fetch`). No `npm install` needed to run.

## How it works

1. **Where** — type an Israeli city (autocomplete) **or click anywhere on the
   map** in Israel. Drag the pin to fine-tune; set the **search area** (1–50 km).
2. **Who** — enter the **number of diners**. (In live mode the table for your
   party is confirmed on the restaurant's reservation page; listings don't
   expose per-table availability.)
3. **When** — pick a **date**, then an **exact dinner time** or a **time range**.
   O·Dine keeps only restaurants **open** during that window (17:00–23:30).

Each result shows the restaurant's cuisine, rating, price level, address and
distance, whether it's open for your time, and a **Reserve a table** link. A map
plots the matches as numbered pins around your search area.

## Reserving

- **Live results** link to the restaurant's **Google listing**, where Google
  surfaces the real reservation options (Ontopo, Ironbooking, etc.).
- **Sample results** link straight to each restaurant's booking platform —
  e.g. Eataliano Dalla Costa → **Ironbooking**, most others → **Ontopo**. The
  provider registry in `app.js` makes adding platforms trivial.

## Deploy

`render.yaml` deploys the app to [Render](https://render.com) (New + →
Blueprint → pick this repo → Apply). Paste your `GOOGLE_PLACES_KEY` when
prompted for live data, or leave it blank to run the sample.

## Project structure

```
index.html   # markup: area (city + map), party size, date, time mode, results
styles.css   # styling / responsive layout
logo.jpg     # O·Dine — Restaurant Seats logo (shown in the header)
data.js      # Israeli cities + curated sample restaurants + fallback engine
app.js       # UI logic: autocomplete, map picker, live fetch, filtering, render
server.js    # static server + /api/restaurants Google Places proxy
```

## Notes & limits

- **Coverage:** Google Places Nearby Search returns up to 20 restaurants per
  search — narrow the area for the most relevant results.
- **Party size:** listings don't expose per-table availability, so O·Dine can't
  guarantee a table for N from Google alone; that's confirmed at booking. Live
  *table* availability would require an official Ontopo/Ironbooking/Tabit API.
- **Sample mode** availability is simulated (deterministic, peaks around 20:00)
  and is only a demo of the flow.
