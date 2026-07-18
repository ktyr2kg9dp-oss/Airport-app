# Expense Manager 💳

A tiny, no-friction app for logging the payments you make **while travelling**.
Open it, and it's already set to today's date and the current hour — just add
the payment and go.

No accounts, no build step, no server-side database. Your trips, payments, and
receipts are saved **on your device** (in the browser's IndexedDB), so the app
works offline and nothing leaves the phone until *you* export it.

## Trips

Payments are grouped into **trips**. Create a trip (e.g. *Grand Canyon trip*)
from the **Trips** library at the top, and every payment you add belongs to the
currently open trip. Tap any trip button to switch to it — the form and the
payments list follow the trip you have open, so you can keep separate running
tallies per trip and jump back and forth at any time.

## Inputs

| Input | Default when the app opens | Notes |
|-------|----------------------------|-------|
| **Date** & **Hour** | **Today** / **current hour** | Side by side; tap **Not relevant** (under the hour) to save without a time. |
| **Location** | **Your current location** | Auto-filled from your location (tap 📍 to refresh); you can also just type a place. |
| **Amount** | — | Tap it to open the **built-in number pad**. The currency shows your **default** on the left and **Other ▾** on the right, which opens the full currency list. |
| **Type of expense** | — | **🍽️ Food**, **🚕 Uber / taxi**, **🏨 Hotel**, **🚗 Car rent**, or **⋯ Other**. *Other* offers quick **🚆 Train** / **🛣️ Toll** buttons **and** a free-text box for anything else. |
| **Payment method** | — | Choose **💵 Cash**, **💳 Card**, or **🏦 Bank transfer**. |
| **Card** | **•••• 4255** | Shown only for card payments — pick **4255**, **6694**, or **1921**. |
| **Receipt** | — | **📷 Take photo** or **⬆︎ Upload receipt**. The app keeps a **light thumbnail** for the list plus a **~1600px full image** for export. |

Each saved payment appears in the current trip's **Payments** list, newest
first, with a running **Total** per currency. **Tap a payment to reopen it** —
you can fix any field and hit **Save payment** to put it back in the list
(sorted by date). The **✕** removes a payment.

## Settings

The **⚙️** button (top-right) opens Settings. Currently it holds **Default
currency** — pick any currency and new payments start with it (shown on the left
of the currency toggle). More settings can be added here over time.

## Export a trip (PDF)

The **⬇︎ Export** button (top-right of the payments list) generates a real
**PDF** for the current trip:

- A summary (payment count + per-currency total).
- A table of **date, time, amount, type of expense, location, card / method**,
  with a small receipt thumbnail per row.
- A **Receipts** section where each **full-resolution** receipt is attached on
  its own page, captioned with its payment details.

The PDF is produced entirely on-device (via a bundled copy of
[jsPDF](https://github.com/parallax/jsPDF) in `vendor/` — no network needed).
From a phone you can then **Save to Files**, email it, or drop it in iCloud.

### A note on receipt storage

A web app **can't** automatically save files into an iPhone's Files or Photos
library, and it can't reach back into Photos later — iOS only allows saving when
*you* tap **Save to Files** through the share sheet. So receipts live **inside
the app** (durably, in IndexedDB): a light thumbnail for the list and a ~1600px
copy for export. **Export** is the on-demand way to pull a trip — table plus the
real receipt images — out to your device as a single PDF.

## Run it

Requires **Node 18+** (uses the built-in `http` module — no `npm install`
needed for the app itself).

```bash
node server.js
# then open http://localhost:3000
```

You can also just open `index.html` directly in a browser — the app is fully
client-side.

## Deploy for free (Render)

This repo includes a `render.yaml` blueprint:

1. In [Render](https://render.com): **New +** → **Blueprint** → pick this repo
   → **Apply**.
2. You get a public URL you can open from any device.

### Install it as an app (Add to Home Screen)

The app is a **PWA**: it ships a web manifest, app icons, and a service worker,
so once it's on an `https://` URL you can install it to your home screen and it
launches **full-screen** (no browser bars) and **works offline**.

- **iPhone (Safari):** open the URL → **Share** → **Add to Home Screen**.
- **Android (Chrome):** open the URL → menu **⋮** → **Install app** /
  **Add to Home screen**.

## Under the hood

- **`index.html` / `styles.css`** — the trips library, the new/edit payment
  form (with the built-in number pad), and the saved-payments list.
- **`app.js`** — trips, date/hour defaults, the number pad, the two-tier
  receipt-photo pipeline, add-or-edit logic, per-trip rendering, and the PDF
  export.
- **`store.js`** — the persistence layer: IndexedDB (with a one-time import
  from the old `localStorage` format) and an in-memory fallback. Payment
  metadata + thumbnails stay cached for fast rendering; full-res images are
  fetched on demand.
- **`vendor/jspdf.umd.min.js`** — bundled PDF generator (no runtime network).
- **`server.js`** — a small, dependency-free static file server.
