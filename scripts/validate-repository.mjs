/**
 * File: Enforces repository documentation, source-header, workflow-pin, secret, and report policies.
 * Major symbols: requiredPaths, authoredExtensions, checks, record, and recursive file collection.
 * State: deterministic policy inputs and generated docs/reports/repository-validation.json evidence.
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(root, "docs", "reports", "repository-validation.json");
const requiredPaths = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "Cargo.toml",
  "Cargo.lock",
  "web/package-lock.json",
  "docs/architecture.md",
  "docs/testing.md",
  "docs/security.md",
  "docs/operations.md",
  "docs/limitations.md",
  "docs/isa-profile.md",
  "docs/code-index.md",
  "docs/research.md",
  "docs/reports/validation.md",
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
];
const authoredExtensions = new Set([".rs", ".ts", ".mjs", ".asm", ".css", ".html", ".sh"]);
const ignoredDirectories = new Set([".git", "target", "node_modules", "build", "dist"]);
const checks = [];

await record("required-files", async () => {
  for (const path of requiredPaths) {
    const metadata = await stat(resolve(root, path));
    if (!metadata.isFile() || metadata.size === 0) {
      throw new Error(`${path} is missing or empty`);
    }
  }
  return `${requiredPaths.length} required files present`;
});

const files = [];
await collectFiles(root, files);

await record("source-headers", async () => {
  const authored = files.filter((path) => authoredExtensions.has(extensionOf(path)));
  for (const path of authored) {
    const prefix = (await readFile(path, "utf8")).split(/\r?\n/u).slice(0, 10).join("\n");
    if (!/\bFile:/u.test(prefix)) {
      throw new Error(`${display(path)} lacks a File header in its first ten lines`);
    }
  }
  return `${authored.length} authored source files contain headers`;
});

await record("workflow-pins", async () => {
  const workflows = files.filter((path) => display(path).startsWith(".github/workflows/"));
  for (const path of workflows) {
    const text = await readFile(path, "utf8");
    for (const match of text.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)) {
      const reference = match[1] ?? "";
      if (!/@[0-9a-f]{40}$/u.test(reference)) {
        throw new Error(`${display(path)} contains a mutable action reference: ${reference}`);
      }
    }
  }
  return `${workflows.length} workflows use immutable action references`;
});

await record("secret-patterns", async () => {
  const textFiles = files.filter((path) => !path.endsWith("package-lock.json") && !path.endsWith("Cargo.lock"));
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
    /ghp_[A-Za-z0-9]{30,}/u,
    /github_pat_[A-Za-z0-9_]{40,}/u,
    /AKIA[0-9A-Z]{16}/u,
  ];
  for (const path of textFiles) {
    const text = await readFile(path, "utf8");
    if (patterns.some((pattern) => pattern.test(text))) {
      throw new Error(`${display(path)} contains a credential-like value`);
    }
  }
  return `${textFiles.length} text files scanned for credential patterns`;
});

await record("bounded-execution", async () => {
  const pipeline = await readFile(resolve(root, "src", "pipeline.rs"), "utf8");
  const machine = await readFile(resolve(root, "src", "machine.rs"), "utf8");
  if (!pipeline.includes("max_cycles") || !pipeline.includes("max_trace_cycles")) {
    throw new Error("pipeline execution and trace bounds are required");
  }
  if (!machine.includes("max_steps")) {
    throw new Error("reference execution must have a step bound");
  }
  return "step, cycle, and retained-trace bounds found";
});

const report = {
  schemaVersion: 1,
  status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
  checks,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (report.status !== "pass") {
  process.exitCode = 1;
} else {
  console.log(`repository validation passed: ${checks.length} policy groups`);
}

async function record(name, operation) {
  try {
    checks.push({ name, status: "pass", evidence: await operation() });
  } catch (error) {
    checks.push({
      name,
      status: "fail",
      evidence: error instanceof Error ? error.message : String(error),
    });
  }
}

async function collectFiles(directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, output);
    } else {
      output.push(path);
    }
  }
}

function display(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function extensionOf(path) {
  return path.slice(path.lastIndexOf("."));
}

