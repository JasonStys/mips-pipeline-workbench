/**
 * File: Assembles compiled modules and static files into a deterministic browser distribution.
 * Major symbols: copyTree and build directory constants. State: fixed source/output locations.
 */

import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const distribution = resolve("dist");
const assets = resolve(distribution, "assets");

await rm(distribution, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
await cp(resolve("public", "index.html"), resolve(distribution, "index.html"));
await cp(resolve("public", "demo-trace.json"), resolve(distribution, "demo-trace.json"));
await cp(resolve("build", "src", "app.js"), resolve(assets, "app.js"));
await cp(resolve("build", "src", "model.js"), resolve(assets, "model.js"));
await cp(resolve("src", "styles.css"), resolve(assets, "styles.css"));

