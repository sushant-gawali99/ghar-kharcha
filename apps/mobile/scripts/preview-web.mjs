import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = normalize(join(__dirname, "..", "dist"));
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function sendFile(res, filePath) {
  const ext = extname(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
}

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const requestedPath = normalize(join(rootDir, pathname));
  if (!requestedPath.startsWith(rootDir)) {
    return null;
  }
  return requestedPath;
}

createServer((req, res) => {
  const targetPath = safePath(req.url || "/");

  if (!targetPath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (existsSync(targetPath) && statSync(targetPath).isFile()) {
    sendFile(res, targetPath);
    return;
  }

  const indexFile = join(rootDir, "index.html");
  sendFile(res, indexFile);
}).listen(port, () => {
  console.log(`Preview server running at http://localhost:${port}`);
});
