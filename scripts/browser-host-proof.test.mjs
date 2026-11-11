/**
 * File: browser-host-proof.test.mjs
 * Purpose: Prove actual Linux missing-library refusal with a tiny owned compiled ELF, and reject invalid paths.
 * Symbols and line locations: see docs/code-index.md.
 * State: static inert test sources only; no browser/user profile, network, package manager or global changes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, renameSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";
import { requireDependencyClosure } from "./browser-host-proof.mjs";

test("dependency-only policy checks load the actual helper without installed packages", () => {
  const root = mkdtempSync(join(tmpdir(), "mips-owned-no-dependencies-"));
  copyFileSync(
    new URL("./browser-host-proof.mjs", import.meta.url),
    join(root, "browser-host-proof.mjs"),
  );
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import { requireDependencyClosure } from "./browser-host-proof.mjs"; if (typeof requireDependencyClosure !== "function") throw new Error("Missing real dependency check"); console.log("actual dependency-free module loaded");',
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 65_536,
    },
  );
  assert.equal(result.trim(), "actual dependency-free module loaded");
});

test("a relative or missing executable cannot satisfy dependency proof", () => {
  assert.throws(() => requireDependencyClosure("not-an-owned-absolute-file"));
});
test(
  "genuine ELF linkage fails closed when its actual required library is absent",
  { skip: process.platform !== "linux" },
  () => {
    const root = mkdtempSync(join(tmpdir(), "mips-owned-linkage-"));
    const library = join(root, "libownedprobe.so"),
      preserved = join(root, "libownedprobe.preserved");
    const executable = join(root, "probe");
    writeFileSync(
      join(root, "library.c"),
      "int owned_probe(void) { return 7; }\n",
      { flag: "wx" },
    );
    writeFileSync(
      join(root, "main.c"),
      "extern int owned_probe(void); int main(void) { return owned_probe() == 7 ? 0 : 1; }\n",
      { flag: "wx" },
    );
    for (const args of [
      ["-shared", "-fPIC", join(root, "library.c"), "-o", library],
      [
        join(root, "main.c"),
        "-L" + root,
        "-Wl,-rpath,$ORIGIN",
        "-lownedprobe",
        "-o",
        executable,
      ],
    ])
      execFileSync("/usr/bin/cc", args, { timeout: 10_000, maxBuffer: 65_536 });
    assert.ok(requireDependencyClosure(executable) > 0);
    renameSync(library, preserved);
    try {
      assert.throws(
        () => requireDependencyClosure(executable),
        /dependency is missing/,
      );
    } finally {
      renameSync(preserved, library);
    }
    assert.ok(requireDependencyClosure(executable) > 0);
  },
);
