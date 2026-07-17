# Expense Manager 💳

A tiny, no-friction app for logging the payments you make **while travelling**.
Open it, and it's already set to today's date and the current hour — just add
the payment and go.

No accounts, no build step, no database. Your payments are saved locally in
your own browser (`localStorage`), so the app works offline and your data
stays on your device.

## Inputs

| Input | Default when the app opens | Notes |
|-------|----------------------------|-------|
| **Date** | **Today's date** | Set fresh every time you open the app. |
| **Hour** | **The current hour** | Tap **Not relevant** if the time doesn't matter — it's saved without an hour. |
| **Payment method** | — | Choose **💵 Cash**, **💳 Card**, or **🏦 Bank transfer**. |
| **Amount** | — | Numeric entry (pops up the number keypad on phones) with a **$ USD / ₪ NIS** toggle. |
| **Card** | **•••• 4255** | Shown only for card payments — pick **4255**, **6694**, or **1921**. |

Choosing a payment method opens the amount entry. Each saved payment appears in
the **Payments** list below the form, newest first, and can be removed with the
**✕** button. More inputs can be added on top of this foundation.

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

- **`index.html` / `styles.css`** — the form and the saved-payments list.
- **`app.js`** — sets the date/hour defaults on open, handles the *Not
  relevant* toggle, and saves/renders payments from `localStorage`.
- **`server.js`** — a small, dependency-free static file server.
