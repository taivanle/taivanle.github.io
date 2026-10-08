import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs",
);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const port = Number(process.env.PORT || 4178);
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const name =
      decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(directory, name);
    if (!file.startsWith(directory + path.sep)) throw new Error("Invalid path");
    const data = await readFile(file);
    const type = mime[path.extname(file)] || "application/octet-stream";
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1]
        ? Number(match[1])
        : Math.max(0, data.length - Number(match?.[2] || 0));
      const end =
        match?.[1] && match?.[2]
          ? Math.min(Number(match[2]), data.length - 1)
          : data.length - 1;
      if (
        !match ||
        (!match[1] && !match[2]) ||
        start >= data.length ||
        end < start
      ) {
        response.writeHead(416, { "Content-Range": `bytes */${data.length}` });
        response.end();
        return;
      }
      response.writeHead(206, {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Content-Length": end - start + 1,
      });
      response.end(
        request.method === "HEAD" ? undefined : data.subarray(start, end + 1),
      );
      return;
    }
    response.writeHead(200, {
      "Content-Type": type,
      "Content-Length": data.length,
      "Accept-Ranges": "bytes",
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Portfolio preview: http://127.0.0.1:${port}`),
);
