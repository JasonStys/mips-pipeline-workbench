/**
 * File: Performs a dependency-free production-distribution smoke and size-budget check.
 * Major symbols: requiredFiles and byteBudget. State: deterministic list of generated artifacts.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const requiredFiles = ["index.html", "demo-trace.json", "assets/app.js", "assets/model.js", "assets/styles.css"];
const byteBudget = 90_000;
let totalBytes = 0;

for (const relativePath of requiredFiles) {
  const absolutePath = resolve("dist", relativePath);
  const metadata = await stat(absolutePath);
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error(`${relativePath} is missing or empty`);
  }
  totalBytes += metadata.size;
}

const html = await readFile(resolve("dist", "index.html"), "utf8");
for (const marker of ["<main id=\"main-content\">", "aria-live=\"polite\"", "assets/app.js"]) {
  if (!html.includes(marker)) {
    throw new Error(`production HTML is missing ${marker}`);
  }
}
if (totalBytes > byteBudget) {
  throw new Error(`production assets use ${totalBytes} bytes, exceeding the ${byteBudget}-byte budget`);
}
console.log(`production smoke passed: ${requiredFiles.length} files, ${totalBytes} bytes`);

