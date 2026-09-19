/**
 * File: Removes only generated web build directories before deterministic compilation.
 * Major symbol: removeGeneratedDirectory. State: fixed build and dist path allowlist.
 */

import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const allowedDirectories = [resolve("build"), resolve("dist")];

for (const directory of allowedDirectories) {
  await rm(directory, { recursive: true, force: true });
}

