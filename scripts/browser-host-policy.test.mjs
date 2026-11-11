/** File: browser-host-policy.test.mjs; Purpose: Preserve the actual original trace/browser acceptance behind a bounded real host proof. Variables: actual workflow and independent negative mutations; no source exclusions or test-result mocking. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const desktop = readFileSync(new URL("../.github/workflows/desktop.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");

/** Require the deliberate reviewed job format; this is not a general YAML security parser. */
function requireBrowserRecipe(source) {
  const found = [...source.matchAll(/^  web:\s*\r?\n([\s\S]*?)(?=^  [a-z][\w-]*:|$(?![\s\S]))/gm)];
  assert.equal(found.length, 1);
  const body = found[0][1];
  for (const required of ["runs-on: ubuntu-24.04", "timeout-minutes: 10", "PLAYWRIGHT_BROWSERS_PATH: ${{ github.workspace }}/.runtime/ci-playwright", "run: npm --prefix web exec -- playwright install chromium", "timeout-minutes: 5", "timeout-minutes: 2", "run: node scripts/browser-host-proof.mjs", "run: npm --prefix web test", "run: npm --prefix web run smoke", "run: npm --prefix web run test:browser", "run: npm --prefix web audit --audit-level=high"]) assert.ok(body.includes(required), `Missing original/host gate: ${required}`);
  assert.ok(body.indexOf("playwright install chromium") < body.indexOf("node scripts/browser-host-proof.mjs"));
  assert.ok(body.indexOf("node scripts/browser-host-proof.mjs") < body.indexOf("npm --prefix web run test:browser"));
  assert.doesNotMatch(body, /install-deps|with-deps|apt-get|SKIP_VALIDATE_HOST_REQUIREMENTS|continue-on-error|\|\|\s*true/);
}

test("actual visualizer job retains all original assertions behind normal browser host validation", () => requireBrowserRecipe(workflow));
for (const [label, before, after] of [
  ["moving image", "runs-on: ubuntu-24.04", "runs-on: ubuntu-latest"],
  ["unowned cache", "PLAYWRIGHT_BROWSERS_PATH: ${{ github.workspace }}/.runtime/ci-playwright", "PLAYWRIGHT_BROWSERS_PATH: /tmp/shared"],
  ["wrong browser", "playwright install chromium", "playwright install firefox"],
  ["missing host proof", "run: node scripts/browser-host-proof.mjs", "run: true"],
  ["removed browser assertions", "run: npm --prefix web run test:browser", "run: true"],
  ["removed compiled source tests", "run: npm --prefix web test", "run: true"],
  ["ignored host failure", "run: node scripts/browser-host-proof.mjs", "run: node scripts/browser-host-proof.mjs || true"],
]) test(`reject ${label}`, () => assert.throws(() => requireBrowserRecipe(workflow.replaceAll(before, after))));

/** The native matrix has its own actual browser gate; preserve every real extracted app path. */
function requireNativeRecipe(source) {
  for (const value of ["timeout-minutes: 25", "os: [ubuntu-24.04, windows-latest, macos-latest]", "PLAYWRIGHT_BROWSERS_PATH: ${{ github.workspace }}/.runtime/ci-playwright", "timeout-minutes: 5", "playwright install chromium", "if: runner.os == 'Linux'\n        timeout-minutes: 2\n        run: node scripts/browser-host-proof.mjs", "command -v xvfb-run", "xvfb-run -a python -m tools.package_app --output-root .runtime/native-ci", "python -m tools.package_app --output-root .runtime/native-ci"]) assert.ok(source.includes(value), `Missing native host/assertion contract: ${value}`);
  assert.doesNotMatch(source, /sudo|apt-get|install-deps|with-deps|SKIP_VALIDATE_HOST_REQUIREMENTS|continue-on-error|\|\|\s*true/);
  assert.ok(source.indexOf("node scripts/browser-host-proof.mjs") < source.indexOf("xvfb-run -a python"));
}

test("actual three-platform native archive journey retains its own mandatory normal Linux host proof", () => requireNativeRecipe(desktop));
for (const [name, before, after] of [
  ["missing native host proof", "run: node scripts/browser-host-proof.mjs", "run: true"],
  ["ignored native setup error", "playwright install chromium", "playwright install chromium || true"],
  ["omitted actual extracted native assertion", "xvfb-run -a python -m tools.package_app", "echo skipped"],
  ["missing actual virtual display", "command -v xvfb-run", "true"],
]) test(`reject ${name}`, () => assert.throws(() => requireNativeRecipe(desktop.replaceAll(before, after))));
