/**
 * File: Serves only known built visualizer files for loopback browser tests.
 * Major symbols: files and server. State: bounded fixed routes, no filesystem path from requests.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/demo-trace.json", ["demo-trace.json", "application/json"]],
  ...["app", "model", "import", "studio"].map((name) => [
    `/assets/${name}.js`,
    [`assets/${name}.js`, "text/javascript; charset=utf-8"],
  ]),
  ["/assets/styles.css", ["assets/styles.css", "text/css; charset=utf-8"]],
]);
const server = createServer(async (request, response) => {
  const target = files.get((request.url ?? "").split("?")[0]);
  if (target === undefined || request.method !== "GET") {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(resolve("dist", target[0]));
    response.writeHead(200, {
      "content-type": target[1],
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(body);
  } catch {
    response
      .writeHead(500)
      .end("Build visualizer before running browser tests.");
  }
});
server.listen(Number(process.env.MIPS_BROWSER_PORT ?? 49193), "127.0.0.1");
