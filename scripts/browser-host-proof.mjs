/**
 * File: browser-host-proof.mjs
 * Purpose: Prove the exact locked browser actually launches with its installed Linux libraries and usable Latin text/layout.
 * Symbols and line locations: see docs/code-index.md.
 * State: CI-only owned browser; no host-validation skip, alternate executable, OS package change or private profile.
 */
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  readlinkSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, basename, resolve, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

/** Validate actual ELF linkage using fixed argv, not a guessed dependency list or an ignored installer failure. */
export function requireDependencyClosure(executable) {
  if (!isAbsolute(executable) || !statSync(executable).isFile())
    throw new Error("An owned regular absolute executable is required.");
  const result = execFileSync("/usr/bin/ldd", [executable], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    env: { PATH: "/usr/bin:/bin", LANG: "C" },
  });
  if (!result.includes("libc.so") || /not found/i.test(result))
    throw new Error("Actual browser/runtime dependency is missing.");
  return result.split("\n").filter((line) => line.trim()).length;
}

/** Linux hosted evidence, with the normal public Playwright launch/host validator still active. */
export async function proveBrowserHost() {
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.RUNNER_OS !== "Linux" ||
    process.platform !== "linux" ||
    process.arch !== "x64" ||
    !/^VERSION_ID="?24[.]04"?$/m.test(readFileSync("/etc/os-release", "utf8"))
  )
    throw new Error(
      "This proof requires the declared disposable Ubuntu24.04 x64 worker.",
    );
  for (const key of [
    "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS",
    "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD",
  ])
    if (key in process.env)
      throw new Error(
        "Browser validation/download bypass variables are forbidden.",
      );
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!cache || !isAbsolute(cache))
    throw new Error("An explicit owned browser cache is required.");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (!resolve(cache).startsWith(root + sep))
    throw new Error("The browser cache must be owned by this checkout.");
  const manifest = JSON.parse(
    readFileSync(
      resolve(root, "web/node_modules/playwright-core/browsers.json"),
      "utf8",
    ),
  );
  const expected = manifest.browsers.find(
    (entry) => entry.name === "chromium-headless-shell",
  );
  if (!expected?.browserVersion)
    throw new Error("Pinned browser version metadata is missing.");
  // The dependency-closure regression also runs in the dependency-free policy job.
  // Only the actual browser journey imports the locked browser tooling.
  const { chromium } = await import("../web/node_modules/@playwright/test/index.mjs");
  const browser = await chromium.launch({ headless: true });
  try {
    if (browser.version() !== expected.browserVersion)
      throw new Error("The actual browser differs from the locked build.");
    const cdp = await browser.newBrowserCDPSession();
    const processes = await cdp.send("SystemInfo.getProcessInfo");
    const main = processes.processInfo.filter(
      (entry) => entry.type === "browser",
    );
    if (
      main.length !== 1 ||
      !Number.isSafeInteger(main[0].id) ||
      main[0].id <= 0
    )
      throw new Error(
        "The exact owned browser process identity is unavailable.",
      );
    const executable = readlinkSync(`/proc/${main[0].id}/exe`);
    if (!executable.startsWith(resolve(cache) + sep))
      throw new Error("Actual executable escaped the locked browser cache.");
    const linkedLibraries = requireDependencyClosure(executable);
    const font = execFileSync(
      "/usr/bin/fc-match",
      ["--format", "%{file}", "sans-serif"],
      {
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 65_536,
        env: { PATH: "/usr/bin:/bin", LANG: "C" },
      },
    ).trim();
    if (
      !["/usr/share/fonts/", "/usr/local/share/fonts/"].some((prefix) =>
        font.startsWith(prefix),
      ) ||
      !statSync(font).isFile()
    )
      throw new Error("A real installed system font is required.");
    const context = await browser.newContext();
    const outside = [];
    await context.route("**/*", (route) => {
      outside.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    const layouts = [];
    for (const width of [390, 1400]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(
        '<!doctype html><html lang="en"><meta charset="utf-8"><style>body{font:16px sans-serif;margin:16px}main{max-width:100%;overflow-wrap:anywhere}button{font:inherit}</style><main><h1>Actual browser text 0123</h1><label>Evidence <input value="Saved result"></label><button>Inspect result</button><p id="text">Readable Latin text and values.</p></main></html>',
      );
      const observed = await page.evaluate(() => {
        const canvas = globalThis.document.createElement("canvas"),
          draw = canvas.getContext("2d");
        if (!draw) throw new Error("Actual text rendering is unavailable.");
        draw.font = "16px sans-serif";
        return {
          width: globalThis.innerWidth,
          documentWidth: globalThis.document.documentElement.scrollWidth,
          narrow: draw.measureText("iiii").width,
          wide: draw.measureText("WWWW").width,
          fontReady: globalThis.document.fonts.check("16px sans-serif"),
          text: globalThis.document.querySelector("#text")?.textContent,
        };
      });
      if (
        observed.width !== width ||
        observed.documentWidth > width ||
        !observed.fontReady ||
        observed.narrow <= 0 ||
        observed.wide <= observed.narrow ||
        observed.text !== "Readable Latin text and values."
      )
        throw new Error("Actual font/layout probe failed.");
      await page.getByRole("button", { name: "Inspect result" }).focus();
      if (
        !(await page
          .getByRole("button", { name: "Inspect result" })
          .evaluate((node) => node === globalThis.document.activeElement))
      )
        throw new Error("Actual browser focus did not work.");
      layouts.push(observed);
    }
    if (outside.length)
      throw new Error("The static host probe attempted an outside resource.");
    await context.close();
    const proof = {
      schema: 1,
      passed: true,
      source: process.env.GITHUB_SHA,
      browserVersion: browser.version(),
      lockedRevision: expected.revision,
      actualExecutable: basename(executable),
      linkedLibraries,
      font: basename(font),
      latinTextAndLayout: layouts,
      outsideRequests: 0,
      scope:
        "Actual locked Chromium/installed library closure and Latin text/layout only. Original full app/package browser commands remain separately mandatory; no multilingual font or clean-machine claim.",
    };
    const folder = resolve(root, "artifacts/browser-host");
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      resolve(folder, "proof.json"),
      JSON.stringify(proof, null, 2) + "\n",
      { flag: "wx" },
    );
    return proof;
  } finally {
    await browser.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await proveBrowserHost();
