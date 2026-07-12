/*
 * Cup-Les backend
 * ------------------------------------------------------------------
 * A tiny, dependency-free relay so a couple's two phones can talk.
 *
 * Each partner opens a Server-Sent Events stream (GET /events) tagged with a
 * shared "pair code" and their role (husband / wife). When one of them taps a
 * button the browser POSTs the chosen phrase to /send, and the server pushes
 * it instantly down the OTHER partner's open stream.
 *
 * No database, no build step — messages live only for the instant it takes to
 * relay them. Run with:  node server.js   (then open http://localhost:3000)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// pairCode -> Map(clientId -> { role, res })
const rooms = new Map();
let nextClientId = 1;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function partnerOf(role) {
  return role === "husband" ? "wife" : "husband";
}

function sanitizePair(code) {
  // Keep it simple + safe: letters, digits, dash/underscore, max 40 chars.
  return String(code || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

// ---- SSE: a partner connects and waits for messages ---------------------
function handleEvents(req, res, url) {
  const pair = sanitizePair(url.searchParams.get("pair"));
  const role = url.searchParams.get("role") === "husband" ? "husband" : "wife";
  if (!pair) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing pair code");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");

  if (!rooms.has(pair)) rooms.set(pair, new Map());
  const room = rooms.get(pair);
  const id = nextClientId++;
  room.set(id, { role, res });

  // Tell this client whether their partner is already online.
  const partnerOnline = [...room.values()].some((c) => c.role === partnerOf(role));
  send(res, "presence", { partnerOnline });
  // Let the partner (if any) know we just arrived.
  broadcast(pair, partnerOf(role), "presence", { partnerOnline: true }, id);

  // Keep the connection alive through proxies.
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(ping);
    room.delete(id);
    if (room.size === 0) rooms.delete(pair);
    else broadcast(pair, partnerOf(role), "presence", { partnerOnline: false });
  });
}

function send(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Push an event to every client in `pair` that has role `toRole`.
function broadcast(pair, toRole, event, data, exceptId) {
  const room = rooms.get(pair);
  if (!room) return 0;
  let n = 0;
  for (const [id, client] of room) {
    if (client.role === toRole && id !== exceptId) {
      send(client.res, event, data);
      n++;
    }
  }
  return n;
}

// ---- POST /send : relay one phrase to the partner -----------------------
function handleSend(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 4096) req.destroy(); // guard against abuse
  });
  req.on("end", () => {
    let msg;
    try {
      msg = JSON.parse(body || "{}");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "bad json" }));
    }
    const pair = sanitizePair(msg.pair);
    const from = msg.from === "husband" ? "husband" : "wife";
    const kind = String(msg.kind || "");
    const text = String(msg.text || "").slice(0, 500);
    if (!pair || !text) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "missing fields" }));
    }
    const delivered = broadcast(pair, partnerOf(from), "message", {
      kind,
      text,
      from,
      at: Date.now(),
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, delivered }));
  });
}

// ---- static files -------------------------------------------------------
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.join(ROOT, path.normalize(rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/events" && req.method === "GET") return handleEvents(req, res, url);
  if (url.pathname === "/send" && req.method === "POST") return handleSend(req, res);
  if (req.method === "GET") return serveStatic(req, res, url);
  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Cup-Les 💑 running at http://localhost:${PORT}`);
});
