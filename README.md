# Cup-Les 💑

A tiny, playful messaging app **just for a couple**. Each partner opens the
app on their own phone, picks who they are, and taps a button to send a little
message straight to the other's screen — in real time.

No accounts, no build step, no database. Just a shared **pair code** and two
phones.

## How it works

1. Both partners open the app and type the **same pair code** (anything you
   like — `lovebirds`, `us42`, …). That's what links your two apps together.
2. Each picks **Husband** or **Wife**.
3. Tap a button → the other phone lights up with a message.

### The Wife's app
One big button:

| Button | What it does |
|--------|--------------|
| **BOW** 🙇‍♀️ | Sends one of **10** loving, praising messages to the husband. |

### The Husband's app
Three buttons:

| Button | What it sends to the wife |
|--------|---------------------------|
| **MAD** 😠 | One of **10** messages saying he's upset because something went wrong. |
| **BAD** 🙁 | One of **10** messages saying she wasn't behaving very nicely. |
| **🥒 (cucumber)** | One of **10** playful messages saying he'd like some intimacy. |

Every tap picks a **random** phrase from that button's set of ten. All the
phrases live in [`data.js`](data.js) if you'd like to edit or add your own.

## Run it

Requires **Node 18+** (uses the built-in `http` module — no `npm install`
needed for the app itself).

```bash
node server.js
# then open http://localhost:3000
```

For the two of you to reach each other from **different phones**, the app
needs to be reachable by both — deploy it (see below) or run it on a machine
both phones can hit on your home network, e.g. `http://<your-computer-ip>:3000`.

### Deploy for free (Render)

This repo includes a `render.yaml` blueprint:

1. In [Render](https://render.com): **New +** → **Blueprint** → pick this repo
   → **Apply**.
2. You get a public URL. Open it on both phones, enter the same pair code, and
   you're connected from anywhere.

## Under the hood

- **`index.html` / `styles.css`** — the two screens (setup + role view).
- **`app.js`** — role selection, sending phrases, rendering incoming ones. It
  connects to the server over **Server-Sent Events** for instant delivery.
- **`server.js`** — a small, dependency-free relay. It holds each open SSE
  connection in memory keyed by *pair code + role*, and when one partner POSTs
  a phrase to `/send` it pushes it down the other partner's stream. Nothing is
  stored — messages exist only for the instant it takes to relay them.
- **`data.js`** — the 4 × 10 phrase catalogue, shared as the single source of
  truth.

### Same-device demo

Open two browser tabs (or windows) to the app, use the same pair code, and
pick a different role in each. Even without a reachable server, the tabs fall
back to a `BroadcastChannel` so you can try the whole flow on one device.

> Cup-Les is meant to be lighthearted fun between partners. Be kind to each
> other. 💛
