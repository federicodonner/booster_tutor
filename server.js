// Minimal static server (no dependencies) for Heroku.
// Serves only the app's public files.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8765;

const FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const entry = FILES[pathname];
    if (!entry || (req.method !== "GET" && req.method !== "HEAD")) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const [file, type] = entry;
    fs.readFile(path.join(__dirname, file), (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Error");
        return;
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  })
  .listen(PORT, () => console.log(`Booster Tutor en http://localhost:${PORT}`));
