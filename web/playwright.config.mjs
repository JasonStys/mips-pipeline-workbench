/**
 * File: Configures real-browser local-import and navigation journeys on an owned loopback test server.
 * Major symbols: port and channel. State: no reuse or termination of preexisting services.
 */
import { defineConfig } from "@playwright/test";

const port = Number(process.env.MIPS_BROWSER_PORT ?? 49193);
const channel = process.env.MIPS_BROWSER_CHANNEL;
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    ...(channel === undefined ? {} : { channel }),
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/serve.mjs",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
