/**
 * File: Defines and validates the versioned pipeline-trace contract used by the browser UI.
 * Major symbols: PipelineTrace, CycleTrace, parsePipelineTrace, clampCycle, and stageValue.
 * State: immutable validated trace values; exact declaration lines are in docs/code-index.md.
 */

export interface TraceSummary {
  readonly cycles: number;
  readonly retired: number;
  readonly stalls: number;
  readonly flushes: number;
  readonly cpi: number;
  readonly finalPc: number;
}

export interface CycleTrace {
  readonly cycle: number;
  readonly fetch: string | null;
  readonly decode: string | null;
  readonly execute: string | null;
  readonly memory: string | null;
  readonly writeBack: string | null;
  readonly event: string | null;
}

export interface PipelineTrace {
  readonly schemaVersion: 1;
  readonly summary: TraceSummary;
  readonly cycles: readonly CycleTrace[];
  readonly registers: readonly number[];
}

const MAX_CYCLES = 10_000;
const MAX_LABEL_LENGTH = 240;

/** Validates unknown JSON at the trust boundary and returns a deeply typed trace. */
export function parsePipelineTrace(input: unknown): PipelineTrace {
  const root = expectRecord(input, "trace");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported trace schema version");
  }
  const summaryValue = expectRecord(root.summary, "summary");
  const cyclesValue = root.cycles;
  if (!Array.isArray(cyclesValue) || cyclesValue.length > MAX_CYCLES) {
    throw new Error(`cycles must be an array with at most ${MAX_CYCLES} entries`);
  }
  if (!Array.isArray(root.registers) || root.registers.length !== 32) {
    throw new Error("registers must contain exactly 32 values");
  }

  const summary: TraceSummary = {
    cycles: expectNonNegativeInteger(summaryValue.cycles, "summary.cycles"),
    retired: expectNonNegativeInteger(summaryValue.retired, "summary.retired"),
    stalls: expectNonNegativeInteger(summaryValue.stalls, "summary.stalls"),
    flushes: expectNonNegativeInteger(summaryValue.flushes, "summary.flushes"),
    cpi: expectFiniteNumber(summaryValue.cpi, "summary.cpi"),
    finalPc: expectUint32(summaryValue.finalPc, "summary.finalPc"),
  };
  const cycles = cyclesValue.map((value, index) => parseCycle(value, index));
  const registers = root.registers.map((value, index) =>
    expectUint32(value, `registers[${index}]`),
  );
  if (summary.cycles < cycles.length) {
    throw new Error("summary.cycles cannot be smaller than the retained trace");
  }
  return { schemaVersion: 1, summary, cycles, registers };
}

/** Clamps user-controlled navigation to an available zero-based cycle index. */
export function clampCycle(index: number, cycleCount: number): number {
  if (!Number.isFinite(index) || cycleCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(index), 0), cycleCount - 1);
}

/** Supplies a readable bubble label without hiding missing-stage semantics from assistive tech. */
export function stageValue(value: string | null): string {
  return value ?? "Bubble";
}

function parseCycle(value: unknown, index: number): CycleTrace {
  const cycle = expectRecord(value, `cycles[${index}]`);
  return {
    cycle: expectNonNegativeInteger(cycle.cycle, `cycles[${index}].cycle`),
    fetch: expectNullableLabel(cycle.fetch, `cycles[${index}].fetch`),
    decode: expectNullableLabel(cycle.decode, `cycles[${index}].decode`),
    execute: expectNullableLabel(cycle.execute, `cycles[${index}].execute`),
    memory: expectNullableLabel(cycle.memory, `cycles[${index}].memory`),
    writeBack: expectNullableLabel(cycle.writeBack, `cycles[${index}].writeBack`),
    event: expectNullableLabel(cycle.event, `cycles[${index}].event`),
  };
}

function expectRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectNullableLabel(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length > MAX_LABEL_LENGTH) {
    throw new Error(`${field} must be null or a short string`);
  }
  return value;
}

function expectNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function expectFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite number`);
  }
  return value;
}

function expectUint32(value: unknown, field: string): number {
  const integer = expectNonNegativeInteger(value, field);
  if (integer > 0xffff_ffff) {
    throw new Error(`${field} must fit in an unsigned 32-bit value`);
  }
  return integer;
}

