/**
 * File: Verifies trace-boundary validation and deterministic cycle navigation helpers.
 * Major tests: valid parsing, schema rejection, cycle bounds, register shape, and bubble labels.
 * State: immutable synthetic trace fixtures; exact declarations are indexed in project docs.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { clampCycle, parsePipelineTrace, stageValue } from "../src/model.js";

const VALID_TRACE = {
  schemaVersion: 1,
  summary: { cycles: 1, retired: 1, stalls: 0, flushes: 0, cpi: 1, finalPc: 4 },
  cycles: [
    {
      cycle: 1,
      fetch: "0x00000000: halt",
      decode: null,
      execute: null,
      memory: null,
      writeBack: null,
      event: null,
    },
  ],
  registers: Array.from({ length: 32 }, () => 0),
};

test("parses a valid version-one trace", () => {
  const trace = parsePipelineTrace(VALID_TRACE);
  assert.equal(trace.cycles[0]?.fetch, "0x00000000: halt");
  assert.equal(trace.registers.length, 32);
});

test("rejects unsupported schemas and malformed registers", () => {
  assert.throws(() => parsePipelineTrace({ ...VALID_TRACE, schemaVersion: 2 }), /schema version/);
  assert.throws(() => parsePipelineTrace({ ...VALID_TRACE, registers: [0] }), /32 values/);
  assert.throws(
    () => parsePipelineTrace({ ...VALID_TRACE, registers: [...VALID_TRACE.registers.slice(0, 31), -1] }),
    /non-negative/,
  );
});

test("clamps non-finite and out-of-range cycle selections", () => {
  assert.equal(clampCycle(Number.NaN, 10), 0);
  assert.equal(clampCycle(-4, 10), 0);
  assert.equal(clampCycle(99, 10), 9);
  assert.equal(clampCycle(3.8, 10), 3);
});

test("labels empty stages without losing their meaning", () => {
  assert.equal(stageValue(null), "Bubble");
  assert.equal(stageValue("0x00000000: nop"), "0x00000000: nop");
});

