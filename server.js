/*
 * Otable backend
 * ------------------------------------------------------------------
 * A tiny static file server for the Otable app. The whole app (restaurant
 * catalogue + table-availability engine) runs in the browser from data.js, so
 * no API keys or external services are required.
 *
 * Run it:
 *     node server.js
 * then open http://localhost:3000
 *
 * To connect a LIVE reservations/restaurant API later, add an endpoint here
 * (e.g. /api/availability) that your key can reach, and have app.js call it —
 * see README.md -> "Connecting a live reservations API".
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;

const STATIC = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, app: "otable" }));
  }

  serveStatic(url, res);
});

function serveStatic(url, res) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(__dirname, path.normalize(pathname));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": STATIC[ext] || "application/octet-stream" });
    res.end(buf);
  });
}

server.listen(PORT, () => {
  console.log(`Otable running at http://localhost:${PORT}`);
});
