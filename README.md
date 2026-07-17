# Expense Manager 💳

A tiny, no-friction app for logging the payments you make **while travelling**.
Open it, and it's already set to today's date and the current hour — just add
the payment and go.

No accounts, no build step, no database. Your payments are saved locally in
your own browser (`localStorage`), so the app works offline and your data
stays on your device.

## Trips

Payments are grouped into **trips**. Create a trip (e.g. *Grand Canyon trip*)
from the **Trips** library at the top, and every payment you add belongs to the
currently open trip. Tap any trip button to switch to it — the form and the
payments list follow the trip you have open, so you can keep separate running
tallies per trip and jump back and forth at any time.

## Inputs

| Input | Default when the app opens | Notes |
|-------|----------------------------|-------|
| **Date** | **Today's date** | Set fresh every time you open the app. |
| **Hour** | **The current hour** | Tap **Not relevant** if the time doesn't matter — it's saved without an hour. |
| **Amount** | — | Tap it to open the **built-in number pad**; works on every device and for every method. Includes a **$ USD / ₪ NIS** toggle. |
| **Type of expense** | — | **🍽️ Food**, **🚕 Uber / taxi**, **🏨 Hotel**, **🚗 Car rent**, or **⋯ Other**. Choosing *Other* reveals sub-types (**🚆 Train**, more later). |
| **Payment method** | — | Choose **💵 Cash**, **💳 Card**, or **🏦 Bank transfer**. |
| **Card** | **•••• 4255** | Shown only for card payments — pick **4255**, **6694**, or **1921**. |
| **Receipt** | — | Snap a photo with your camera (or attach one). It's downscaled and stored with the payment; a thumbnail shows in the list. |

Each saved payment appears in the current trip's **Payments** list, newest
first, with a running **Total** per currency. **Tap a payment to reopen it** —
you can fix any field and hit **Save payment** to put it back in the list
(sorted by date). The **✕** removes a payment.

## Export a trip

The **⬇︎ Export** button (top-right of the payments list) opens a clean,
self-contained report for the current trip: a table of **date, time, amount,
type of expense, card / method, and a receipt thumbnail**. Tap any thumbnail to
open the full receipt image. The report has a **Print / Save as PDF** button and
is a single standalone file, so from a phone you can **Save to Files**, email it,
or print it — this is how you get a permanent copy (with receipts) off the app.

### A note on receipt storage

A web app can't automatically save files into an iPhone's Files or Photos
library — iOS only lets that happen when *you* tap **Save to Files** through the
share sheet. So receipts live **inside the app**, and **Export** is the on-demand
way to pull a trip (table + images) out to your device whenever you want.

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
2. You get a public URL you can open from any device. On your phone, use
   **Add to Home Screen** so it behaves like a real installed app.

## Under the hood

- **`index.html` / `styles.css`** — the trips library, the new/edit payment
  form (with the built-in number pad), and the saved-payments list.
- **`app.js`** — trips, date/hour defaults, the number pad, receipt-photo
  capture/downscaling, add-or-edit logic, and per-trip rendering. Trips and
  payments are persisted in `localStorage`.
- **`server.js`** — a small, dependency-free static file server.
