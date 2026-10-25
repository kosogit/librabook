import "./server/config.js";
import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createBackend } from "./server/app.js";

const production = process.argv.includes("--production");
if (!production) {
  const { createServer } = await import("vite");
  const server = await createServer();
  await server.listen();
  server.printUrls();
} else {
  const root = resolve("dist");
  await stat(resolve(root, "index.html")).catch(() => {
    throw new Error("Build the frontend first: npm run build");
  });
  const api = createBackend();
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ttf": "font/ttf",
    ".webmanifest": "application/manifest+json",
  };
  const server = createHttpServer((req, res) =>
    api(req, res, async () => {
      try {
        if (!["GET", "HEAD"].includes(req.method)) {
          res.writeHead(405);
          return res.end();
        }
        const pathname = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        );
        if (pathname.split("/").some(part => part.startsWith("."))) {
          res.writeHead(404); return res.end("Not found");
        }
        let path = resolve(
          root,
          `.${pathname === "/" ? "/index.html" : pathname}`,
        );
        if (!path.startsWith(root + sep)) {
          res.writeHead(403);
          return res.end();
        }
        let info;
        try {
          info = await stat(path);
        } catch {
          if (extname(pathname)) {
            res.writeHead(404);
            return res.end("Not found");
          }
          path = resolve(root, "index.html");
          info = await stat(path);
        }
        if (!info.isFile()) {
          res.writeHead(404);
          return res.end();
        }
        res.writeHead(200, {
          "Content-Type": mime[extname(path)] || "application/octet-stream",
          "Content-Length": info.size,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Cache-Control": pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        });
        if (req.method === "HEAD") return res.end();
        createReadStream(path)
          .on("error", () => res.destroy())
          .pipe(res);
      } catch {
        if (!res.headersSent) res.writeHead(400);
        res.end("Invalid request");
      }
    }),
  );
  const port = Number(process.env.PORT || 3000);
  server.listen(port, "0.0.0.0", () =>
    console.log(`LibraBook running at http://localhost:${port}`),
  );
}
