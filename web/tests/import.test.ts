/**
 * File: Tests the local file/JSON boundary independently of browser rendering.
 * Major tests: exact byte caps, UTF-8 corruption, schema shape, ordered cycles and immutable failure.
 * State: synthetic evidence only; size-rejected files must not be read at all.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TRACE_BYTES,
  parseTraceText,
  readTraceFile,
} from "../src/import.js";
import { parsePipelineTrace } from "../src/model.js";

const TRACE = {
  schemaVersion: 1,
  summary: { cycles: 2, retired: 1, stalls: 0, flushes: 0, cpi: 2, finalPc: 4 },
  cycles: [1, 2].map((cycle) => ({
    cycle,
    fetch: "0x00000000: halt",
    decode: null,
    execute: null,
    memory: null,
    writeBack: null,
    event: null,
  })),
  registers: Array<number>(32).fill(0),
};

test("imports a UTF-8 file through its actual byte content", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(TRACE));
  const result = await readTraceFile({
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  });
  assert.equal(result.cycles.length, 2);
  assert.equal(result.cycles[1]?.cycle, 2);
});

test("checks file size before reading and rejects changed bytes and corrupt UTF-8", async () => {
  for (const size of [0, -1, Number.NaN, MAX_TRACE_BYTES + 1]) {
    let read = false;
    await assert.rejects(
      readTraceFile({
        size,
        arrayBuffer: async () => {
          read = true;
          return new ArrayBuffer(1);
        },
      }),
      /nonempty/,
    );
    assert.equal(read, false);
  }
  await assert.rejects(
    readTraceFile({ size: 2, arrayBuffer: async () => new ArrayBuffer(3) }),
    /size changed/,
  );
  await assert.rejects(
    readTraceFile({
      size: 2,
      arrayBuffer: async () => new Uint8Array([0xc3, 0x28]).buffer,
    }),
    /UTF-8/,
  );
});

test("distinguishes malformed JSON from shape errors and bounds encoded text", () => {
  assert.throws(() => parseTraceText("{"), /valid JSON/);
  assert.throws(() => parseTraceText("x".repeat(MAX_TRACE_BYTES + 1)), /8 MiB/);
  assert.throws(
    () => parseTraceText("é".repeat(MAX_TRACE_BYTES / 2 + 1)),
    /8 MiB/,
  );
  assert.throws(() => parseTraceText("null"), /must be an object/);
});

test("rejects unknown fields at each contract level", () => {
  assert.throws(
    () => parsePipelineTrace({ ...TRACE, secret: "ignored?" }),
    /unsupported field secret/,
  );
  assert.throws(
    () =>
      parsePipelineTrace({ ...TRACE, summary: { ...TRACE.summary, CPI: 2 } }),
    /unsupported field CPI/,
  );
  assert.throws(
    () =>
      parsePipelineTrace({
        ...TRACE,
        cycles: [{ ...TRACE.cycles[0], unknown: true }],
      }),
    /unsupported field unknown/,
  );
});

test("rejects duplicate, reversed, zero and out-of-summary cycle identifiers", () => {
  for (const values of [
    [1, 1],
    [2, 1],
    [0, 1],
    [1, 3],
  ]) {
    assert.throws(
      () =>
        parsePipelineTrace({
          ...TRACE,
          cycles: values.map((cycle) => ({ ...TRACE.cycles[0], cycle })),
        }),
      /strictly increasing/,
    );
  }
});

test("bounds stage labels, cycle arrays and architectural register values", () => {
  assert.throws(
    () =>
      parsePipelineTrace({
        ...TRACE,
        cycles: Array(10_001).fill(TRACE.cycles[0]),
      }),
    /at most 10000/,
  );
  assert.throws(
    () =>
      parsePipelineTrace({
        ...TRACE,
        cycles: [{ ...TRACE.cycles[0], fetch: "x".repeat(241) }],
      }),
    /short string/,
  );
  assert.throws(
    () =>
      parsePipelineTrace({
        ...TRACE,
        cycles: [{ ...TRACE.cycles[0], execute: { code: "halt" } }],
      }),
    /short string/,
  );
  assert.throws(
    () =>
      parsePipelineTrace({
        ...TRACE,
        registers: [1, ...TRACE.registers.slice(1)],
      }),
    /\$zero/,
  );
  assert.throws(
    () =>
      parsePipelineTrace({
        ...TRACE,
        registers: [...TRACE.registers.slice(0, 31), 0x1_0000_0000],
      }),
    /unsigned 32-bit/,
  );
});

test("accepts an honest empty retained trace without inventing cycle evidence", () => {
  assert.equal(parsePipelineTrace({ ...TRACE, cycles: [] }).cycles.length, 0);
  const input = JSON.stringify(TRACE);
  assert.equal(JSON.stringify(parseTraceText(input)), input);
});
