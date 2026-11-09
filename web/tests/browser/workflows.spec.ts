/**
 * File: Exercises local file import, playback, keyboard focus, failure retention and bounded rendering.
 * Major tests: student exploration, invalid evidence recovery, no-code-execution and large/empty traces.
 * State: procedural JSON only; no user data or remote compiler is involved.
 */
import { expect, test, type Page } from "@playwright/test";

function trace(count = 3, label = "0x00000000: halt") {
  return {
    schemaVersion: 1,
    summary: {
      cycles: count,
      retired: count === 0 ? 0 : 1,
      stalls: 0,
      flushes: 0,
      cpi: count,
      finalPc: 4,
    },
    cycles: Array.from({ length: count }, (_, index) => ({
      cycle: index + 1,
      fetch: label,
      decode: null,
      execute: null,
      memory: null,
      writeBack: null,
      event: index === 1 ? "Synthetic load-use interlock" : null,
    })),
    registers: Array<number>(32).fill(0),
  };
}

async function upload(
  page: Page,
  evidence: unknown,
  name = "student-trace.json",
) {
  await page
    .getByLabel("Local trace JSON")
    .setInputFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(evidence)),
    });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#status")).toContainText(
    "Loaded 18 retained cycles",
  );
});

test("student imports a trace, inspects hazards, jumps, steps and plays without stealing input keys", async ({
  page,
}) => {
  await upload(page, trace());
  await expect(page.locator("#trace-source")).toContainText(
    "student-trace.json",
  );
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 1 of 3");
  const jump = page.getByLabel("Go to retained cycle number");
  await jump.fill("30");
  await jump.press("Enter");
  await expect(page.locator("#status")).toContainText("not retained");
  await jump.fill("3");
  await jump.press("ArrowRight");
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 1 of 3");
  await jump.press("Enter");
  await expect(page.locator("#status")).not.toHaveAttribute(
    "data-kind",
    "error",
  );
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 3 of 3");
  await expect(
    page.getByRole("button", { name: "Next →", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "← Previous", exact: true }).click();
  await expect(page.locator("#cycle-event")).toHaveText(
    "Synthetic load-use interlock",
  );
  await page.getByLabel("Selected cycle").focus();
  await page.getByLabel("Selected cycle").press("ArrowLeft");
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 1 of 3");
  await page
    .getByRole("button", { name: "Next hazard / event", exact: true })
    .click();
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 2 of 3");
  await page.clock.install();
  await page.getByLabel("Playback interval").selectOption("250");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(250);
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 3 of 3");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 1 of 3");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 1 of 3");
});

test("a slow demo reload cannot overwrite a newer local selection", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  let received: (() => void) | undefined;
  let completed: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    received = resolve;
  });
  const responded = new Promise<void>((resolve) => {
    completed = resolve;
  });
  await page.route("**/demo-trace.json", async (route) => {
    received?.();
    await held;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(trace(7)),
    });
    completed?.();
  });
  await page
    .getByRole("button", { name: "Reload demonstration", exact: true })
    .click();
  await started;
  await upload(page, trace(), "newer-selection.json");
  await expect(page.locator("#trace-source")).toContainText(
    "newer-selection.json",
  );
  release?.();
  await responded;
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 1 of 3");
  await expect(page.locator("#trace-source")).toContainText(
    "newer-selection.json",
  );
});

test("invalid imports preserve selected evidence and local labels cannot execute markup", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });
  await upload(page, trace(3, '<img src=x onerror="globalThis.pwned=true">'));
  await expect(page.locator("#stage-if")).toContainText("<img");
  expect(await page.locator("#stage-if img").count()).toBe(0);
  expect(await page.evaluate(() => "pwned" in globalThis)).toBe(false);
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await upload(page, { ...trace(), registers: [] }, "broken.json");
  await expect(page.locator("#status")).toContainText("32 values");
  await expect(page.locator("#status")).toContainText(
    "previous valid trace is unchanged",
  );
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 2 of 3");
  await expect(page.locator("#trace-source")).toContainText(
    "student-trace.json",
  );
  await page
    .getByLabel("Local trace JSON")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });
  await expect(page.locator("#status")).toContainText("not valid JSON");
  await upload(page, trace(), "corrected.json");
  await expect(page.locator("#status")).toContainText(
    "Loaded 3 retained cycles",
  );
  expect(requests).toEqual([]);
});

test("large traces render a finite table window and empty traces disable misleading controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page, trace(10_000));
  await expect(page.locator("#status")).toContainText(
    "Loaded 10000 retained cycles",
  );
  await expect(page.locator("#trace-rows tr")).toHaveCount(100);
  await page.getByLabel("Go to retained cycle number").fill("10000");
  await page.getByRole("button", { name: "Go to cycle", exact: true }).click();
  await expect(page.locator("#cycle-label")).toHaveText("Cycle 10000 of 10000");
  await expect(page.locator("#trace-window")).toContainText("9901–10000");
  await expect(page.locator("#trace-rows tr")).toHaveCount(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await upload(page, trace(0));
  await expect(page.locator("#status")).toContainText("no cycles");
  await expect(page.locator("#trace-rows tr")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Selected cycle")).toBeDisabled();
  await page
    .getByRole("button", { name: "Reload demonstration", exact: true })
    .click();
  await expect(page.locator("#status")).toContainText(
    "Loaded 18 retained cycles",
  );
});
