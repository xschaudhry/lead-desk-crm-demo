// Tiny zero-dependency static server for local preview: `npm start`
// Serves this folder on http://localhost:5173 (or $PORT) and applies the same
// response headers as vercel.json, so the security policy is tested locally too.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 5173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json"
};

let headers = {};
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  (cfg.headers || []).forEach((rule) => rule.headers.forEach((h) => { headers[h.key] = h.value; }));
} catch (e) {
  /* no vercel.json: serve without extra headers */
}

// Files that are not part of the published app (mirrors .vercelignore).
const hidden = [".claude", ".agents", "PROJECT_BRIEF.md", "skills-lock.json", ".git"];

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(root, urlPath === "/" ? "index.html" : urlPath);
  const rel = path.relative(root, file).split(path.sep)[0];
  if (!file.startsWith(root) || hidden.includes(rel)) {
    res.writeHead(404); return res.end("Not found");
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, Object.assign({ "Content-Type": types[path.extname(file)] || "application/octet-stream" }, headers));
    res.end(data);
  });
}).listen(port, () => console.log(`Lead Desk demo: http://localhost:${port}`));
