// Local preview server: serves the static site and runs api/*.mjs handlers the
// same way Vercel does, with variables loaded from .env.local.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");
const port = Number(process.env.PORT || process.argv[2] || 5501);

const contents = await readFile(".env.local", "utf8").catch(() => "");
for (const line of contents.split(/\r?\n/)) {
  const trimmed = line.trim();
  const separator = trimmed.indexOf("=");
  if (!trimmed || trimmed.startsWith("#") || separator === -1) continue;
  const key = trimmed.slice(0, separator).trim();
  process.env[key] ??= trimmed.slice(separator + 1).trim();
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4"
};

async function handleApi(req, res, url) {
  const file = join(root, "api", `${url.pathname.slice("/api/".length)}.mjs`);
  const handlers = await import(`${pathToFileURL(file).href}?t=${Date.now()}`).catch(() => null);
  const handler = handlers?.[req.method];
  if (!handler) {
    res.writeHead(handlers ? 405 : 404).end();
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks)
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function resolveStatic(pathname) {
  const base = normalize(join(root, decodeURIComponent(pathname)));
  if (!base.startsWith(root)) return null;
  for (const candidate of [base, `${base}.html`, join(base, "index.html")]) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    const file = await resolveStatic(url.pathname);
    if (!file) return res.writeHead(404).end("Not found");
    res.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("Server error");
  }
}).listen(port, () => console.log(`WineBank preview on http://localhost:${port}`));
