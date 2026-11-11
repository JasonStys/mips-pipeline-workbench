/**
 * File: Drives the actual extracted native application's editable Rust workflows in Chromium.
 * Major symbols: check and downloaded; locations: docs/code-index.md. State: one owned browser/page.
 * No source server, mock response, fixed demo executable or normal user workspace is used.
 */
import { chromium } from "../web/node_modules/playwright-core/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const [url, output, expectedSource] = process.argv.slice(2);
if (
  url === undefined ||
  output === undefined ||
  !/^[a-f0-9]{40}$/u.test(expectedSource ?? "")
)
  throw new Error("Expected owned URL, fresh output and full source SHA");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

/** A real browser download is bounded before parse; source/report fields must match the selected run. */
async function downloaded(action) {
  const promise = page.waitForEvent("download", { timeout: 10000 });
  await action();
  const download = await promise;
  const stream = await download.createReadStream();
  assert.ok(stream);
  let size = 0;
  const blocks = [];
  for await (const chunk of stream) {
    size += chunk.length;
    assert.ok(size <= 8 * 1024 * 1024);
    blocks.push(chunk);
  }
  return JSON.parse(Buffer.concat(blocks).toString("utf8"));
}
/** Wait for a concrete observed UI condition; there are no test retries or fixed sleep workarounds. */
async function check(selector, text) {
  await page
    .locator(selector)
    .filter({ hasText: text })
    .waitFor({ timeout: 15000 });
}
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  await check("#studio-status", "Native Rust engine connected");
  const assembly =
    "# Original synthetic checksum step\nli $t0,64\nli $t1,5\nsw $t1,0($t0)\nlw $t2,0($t0)\naddu $t3,$t2,$t1\nhalt";
  await page
    .getByLabel("Experiment title", { exact: true })
    .fill("Custom checksum workspace");
  await page.getByLabel("Assembly source", { exact: true }).fill(assembly);
  await page.getByRole("button", { name: "Run assembly", exact: true }).click();
  await check("#comparison", "Verified: all 32 registers");
  const execution = await downloaded(() =>
    page
      .getByRole("button", { name: "Export selected experiment", exact: true })
      .click(),
  );
  assert.equal(execution.engine.sourceCommit, expectedSource);
  assert.equal(execution.version, "1.1.0");
  assert.equal(execution.input.source, assembly);
  assert.equal(execution.report.equivalent, true);
  assert.deepEqual(
    execution.report.trace.registers.slice(8, 12),
    [64, 5, 5, 10],
  );
  assert.equal(execution.report.reference.finalPc, 24);
  assert.equal(execution.report.trace.summary.cycles, 11);
  assert.equal(execution.report.trace.summary.stalls, 1);
  assert.equal(execution.report.listing[0].line, 2);
  assert.equal(execution.report.listing[0].word, 0x24080040);
  assert.ok(
    execution.report.pipelineMemory.some(
      (row) => row.address === 64 && row.word === 5,
    ),
  );
  await page
    .getByLabel("Assembly source", { exact: true })
    .fill("# valid physical line\n\nunsupported $t0");
  await page.getByRole("button", { name: "Run assembly", exact: true }).click();
  await check("#studio-status", "assembly at source line 3");
  const unchanged = await downloaded(() =>
    page
      .getByRole("button", { name: "Export selected experiment", exact: true })
      .click(),
  );
  assert.deepEqual(unchanged, execution);
  await page.getByLabel("Assembly source", { exact: true }).fill(assembly);
  await page.locator("#assembly-form").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "01-custom-assembly.png"),
    fullPage: false,
  });
  await page
    .getByLabel("Experiment title", { exact: true })
    .fill("LRU real address experiment");
  await page
    .getByLabel("Decimal or 0x hexadecimal byte addresses", { exact: true })
    .fill("0x0,4,8,0,16,8,0");
  await page
    .getByRole("button", { name: "Run cache experiment", exact: true })
    .click();
  await check("#comparison", "1 hits / 6 misses over 7 accesses");
  const cache = await downloaded(() =>
    page
      .getByRole("button", { name: "Export selected experiment", exact: true })
      .click(),
  );
  assert.equal(cache.engine.sourceCommit, expectedSource);
  assert.deepEqual(
    cache.report.observations.map((row) => row.hit),
    [false, false, false, true, false, false, false],
  );
  await page.getByLabel("Power-of-two line bytes", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Run cache experiment", exact: true })
    .click();
  await check("#studio-status", "power of two");
  assert.deepEqual(
    await downloaded(() =>
      page
        .getByRole("button", {
          name: "Export selected experiment",
          exact: true,
        })
        .click(),
    ),
    cache,
  );
  await page.getByLabel("Power-of-two line bytes", { exact: true }).fill("4");
  await page
    .getByLabel("Literal title search", { exact: true })
    .fill("checksum");
  await page
    .getByRole("button", { name: "Search saved history", exact: true })
    .click();
  await check("#history-count", "1 matching records");
  await page.locator("#history-list button").click();
  await check("#comparison", "Verified: all 32 registers");
  assert.deepEqual(
    await downloaded(() =>
      page
        .getByRole("button", {
          name: "Export selected experiment",
          exact: true,
        })
        .click(),
    ),
    execution,
  );
  const forged = {
    ...execution,
    report: { status: "verified", trace: "forged imported result" },
  };
  const importedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/run") &&
      response.request().method() === "POST",
  );
  await page
    .getByLabel("Import and rerun exported experiment", { exact: true })
    .setInputFiles({
      name: "reproducible-experiment.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(forged)),
    });
  assert.equal((await importedResponse).status(), 201);
  await check("#studio-status", "Selected saved execution evidence");
  const rerun = await downloaded(() =>
    page
      .getByRole("button", { name: "Export selected experiment", exact: true })
      .click(),
  );
  assert.notEqual(rerun.id, execution.id);
  assert.deepEqual(rerun.report, execution.report);
  assert.equal(rerun.engine.sourceCommit, expectedSource);
  await page.getByLabel("Literal title search", { exact: true }).fill("LRU");
  await page
    .getByRole("button", { name: "Search saved history", exact: true })
    .click();
  await check("#history-count", "1 matching records");
  await page.locator("#history-list button").click();
  await check("#comparison", "1 hits / 6 misses");
  await page.locator("#comparison").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "02-cache-history-evidence.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page
    .getByRole("button", { name: "Quit owned application", exact: true })
    .click();
  await check("#studio-status", "Closing the owned app");
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "browser-acceptance.json"),
    JSON.stringify(
      {
        passed: true,
        sourceCommit: expectedSource,
        version: "1.1.0",
        execution: {
          registers: [64, 5, 5, 10],
          finalPc: 24,
          cycles: 11,
          stalls: 1,
        },
        cache: { hits: 1, misses: 6 },
        physicalFaultLine: 3,
        priorEvidencePreserved: true,
        importClaimsRerun: true,
        filteredHistory: true,
        mobileOverflow: false,
        actualBrowser: "Chromium",
        testRetries: 0,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
