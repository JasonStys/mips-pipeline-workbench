/**
 * File: Renders an accessible, keyboard-operable view of a validated pipeline trace.
 * Major symbols: start, renderSummary, renderCycle, renderTable, and renderRegisters.
 * State: currentCycle stores the selected zero-based trace index; locations are indexed in docs.
 */

import {
  clampCycle,
  stageValue,
  type CycleTrace,
  type PipelineTrace,
} from "./model.js";

import { parseTraceText, readTraceFile } from "./import.js";
import { startStudio } from "./studio.js";

const REGISTER_NAMES = [
  "$zero",
  "$at",
  "$v0",
  "$v1",
  "$a0",
  "$a1",
  "$a2",
  "$a3",
  "$t0",
  "$t1",
  "$t2",
  "$t3",
  "$t4",
  "$t5",
  "$t6",
  "$t7",
  "$s0",
  "$s1",
  "$s2",
  "$s3",
  "$s4",
  "$s5",
  "$s6",
  "$s7",
  "$t8",
  "$t9",
  "$k0",
  "$k1",
  "$gp",
  "$sp",
  "$fp",
  "$ra",
] as const;

let currentCycle = 0;
let activeTrace: PipelineTrace | undefined;
let loadGeneration = 0;
let playbackTimer: ReturnType<typeof setInterval> | undefined;
let tableWindow = -1;
const TABLE_WINDOW_SIZE = 100;

/** Wire controls once; async generation guards prevent a slow demo load replacing a local import. */
async function start(): Promise<void> {
  configureNavigation();
  requiredElement<HTMLInputElement>("trace-file").addEventListener(
    "change",
    async (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (file === undefined) return;
      const generation = ++loadGeneration;
      stopPlayback();
      try {
        const trace = await readTraceFile(file);
        if (generation === loadGeneration)
          adoptTrace(trace, `Local file: ${file.name.slice(0, 200)}`);
      } catch (error: unknown) {
        if (generation === loadGeneration) reportError(error);
      } finally {
        input.value = ""; // The same corrected file can be selected again.
      }
    },
  );
  requiredElement<HTMLButtonElement>("load-demo").addEventListener(
    "click",
    () => void loadDemo(),
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPlayback();
  });
  window.addEventListener("pagehide", stopPlayback);
  await loadDemo();
  await startStudio(adoptTrace);
}

/** Load only the shipped example; local files never leave this browser. */
async function loadDemo(): Promise<void> {
  const generation = ++loadGeneration;
  stopPlayback();
  try {
    const response = await fetch("./demo-trace.json", { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Trace request failed with HTTP ${response.status}`);
    const trace = parseTraceText(await response.text());
    if (generation === loadGeneration)
      adoptTrace(trace, "Shipped CLI-generated demonstration");
  } catch (error: unknown) {
    if (generation === loadGeneration) reportError(error);
  }
}

/** Commit an entirely validated trace, retaining the old workspace on any failed import. */
function adoptTrace(trace: PipelineTrace, source: string): void {
  stopPlayback();
  activeTrace = trace;
  tableWindow = -1;
  renderSummary(trace);
  renderRegisters(trace);
  requiredElement<HTMLInputElement>("cycle-slider").max = String(
    Math.max(trace.cycles.length - 1, 0),
  );
  setText(
    "trace-source",
    `${source}. Shape and bounds validated locally; execution correctness is not verified by this viewer.`,
  );
  renderCycle(0);
  const status = requiredElement<HTMLElement>("status");
  status.dataset.kind = "success";
  status.textContent =
    trace.cycles.length === 0
      ? "This trace retains no cycles. Final summary/registers remain available; navigation is disabled."
      : `Loaded ${trace.cycles.length} retained cycles. ${trace.summary.cycles > (trace.cycles.at(-1)?.cycle ?? 0) ? "Only a partial trace was retained; final registers describe completion." : "Ready to explore."}`;
}

/** Keep errors readable without exposing supplied HTML or destroying the last valid trace. */
function reportError(error: unknown): void {
  const status = requiredElement<HTMLElement>("status");
  status.textContent = `${error instanceof Error ? error.message : "Unable to load the trace."} ${activeTrace === undefined ? "Choose a valid trace or reload the demo." : "Your previous valid trace is unchanged."}`;
  status.dataset.kind = "error";
}

function renderSummary(trace: PipelineTrace): void {
  setText("metric-cycles", String(trace.summary.cycles));
  setText("metric-cpi", trace.summary.cpi.toFixed(2));
  setText("metric-stalls", String(trace.summary.stalls));
  setText("metric-flushes", String(trace.summary.flushes));
}

/** Use current state rather than adding listeners for each imported file; ignore editable controls. */
function configureNavigation(): void {
  requiredElement<HTMLInputElement>("cycle-slider").addEventListener(
    "input",
    (event) =>
      navigate(Number((event.currentTarget as HTMLInputElement).value)),
  );
  requiredElement<HTMLButtonElement>("previous-cycle").addEventListener(
    "click",
    () => navigate(currentCycle - 1),
  );
  requiredElement<HTMLButtonElement>("next-cycle").addEventListener(
    "click",
    () => navigate(currentCycle + 1),
  );
  requiredElement<HTMLButtonElement>("next-event").addEventListener(
    "click",
    () => {
      const next =
        activeTrace?.cycles.findIndex(
          (cycle, index) => index > currentCycle && cycle.event !== null,
        ) ?? -1;
      if (next >= 0) navigate(next);
    },
  );
  requiredElement<HTMLFormElement>("jump-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const number = Number(
        requiredElement<HTMLInputElement>("cycle-jump").value,
      );
      const index =
        activeTrace?.cycles.findIndex((cycle) => cycle.cycle === number) ?? -1;
      if (!Number.isSafeInteger(number) || index < 0)
        reportError(
          new Error("That cycle is not retained in the current trace."),
        );
      else navigate(index);
    },
  );
  requiredElement<HTMLButtonElement>("play-trace").addEventListener(
    "click",
    togglePlayback,
  );
  requiredElement<HTMLSelectElement>("playback-speed").addEventListener(
    "change",
    () => {
      if (playbackTimer !== undefined) {
        stopPlayback();
        togglePlayback();
      }
    },
  );
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.target instanceof Element &&
        event.target.closest("input,textarea,select,button,[contenteditable]"))
    )
      return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigate(currentCycle - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      navigate(currentCycle + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      navigate(0);
    } else if (event.key === "End") {
      event.preventDefault();
      navigate((activeTrace?.cycles.length ?? 1) - 1);
    } else if (event.key === "Escape") stopPlayback();
  });
}

/** Stop playback for manual navigation, preserving the selected trace and keyboard focus. */
function navigate(index: number): void {
  stopPlayback();
  renderCycle(index);
  const status = requiredElement<HTMLElement>("status");
  if (activeTrace !== undefined && status.dataset.kind === "error") {
    status.dataset.kind = "success";
    status.textContent =
      "Exploring the current validated trace. No file was uploaded or executed.";
  }
}

/** Play finite retained evidence at the selected rate; completion/hidden page stops the timer. */
function togglePlayback(): void {
  if (playbackTimer !== undefined) {
    stopPlayback();
    return;
  }
  if (activeTrace === undefined || activeTrace.cycles.length < 2) return;
  if (currentCycle === activeTrace.cycles.length - 1) renderCycle(0);
  const interval = Number(
    requiredElement<HTMLSelectElement>("playback-speed").value,
  );
  playbackTimer = setInterval(
    () => {
      if (
        activeTrace === undefined ||
        currentCycle >= activeTrace.cycles.length - 1
      ) {
        stopPlayback();
        return;
      }
      renderCycle(currentCycle + 1);
      if (currentCycle === activeTrace.cycles.length - 1) stopPlayback();
    },
    [250, 500, 1000].includes(interval) ? interval : 500,
  );
  requiredElement<HTMLButtonElement>("play-trace").textContent = "Pause";
  requiredElement<HTMLButtonElement>("play-trace").setAttribute(
    "aria-pressed",
    "true",
  );
}

/** Release the single owned playback timer; importing or leaving never creates background replay. */
function stopPlayback(): void {
  if (playbackTimer !== undefined) clearInterval(playbackTimer);
  playbackTimer = undefined;
  requiredElement<HTMLButtonElement>("play-trace").textContent = "Play";
  requiredElement<HTMLButtonElement>("play-trace").setAttribute(
    "aria-pressed",
    "false",
  );
}

function renderCycle(requestedIndex: number): void {
  const trace = activeTrace;
  if (trace === undefined) return;
  currentCycle = clampCycle(requestedIndex, trace.cycles.length);
  const cycle = trace.cycles[currentCycle];
  const empty = cycle === undefined;
  requiredElement<HTMLInputElement>("cycle-slider").value =
    String(currentCycle);
  requiredElement<HTMLInputElement>("cycle-slider").disabled = empty;
  requiredElement<HTMLButtonElement>("previous-cycle").disabled =
    empty || currentCycle === 0;
  requiredElement<HTMLButtonElement>("next-cycle").disabled =
    empty || currentCycle === trace.cycles.length - 1;
  requiredElement<HTMLButtonElement>("play-trace").disabled =
    trace.cycles.length < 2;
  requiredElement<HTMLButtonElement>("next-event").disabled =
    !trace.cycles.some(
      (row, index) => index > currentCycle && row.event !== null,
    );
  requiredElement<HTMLInputElement>("cycle-jump").disabled = empty;
  requiredElement<HTMLButtonElement>("jump-cycle").disabled = empty;
  setText(
    "cycle-label",
    cycle === undefined
      ? "No retained cycles"
      : `Cycle ${cycle.cycle} of ${trace.summary.cycles}`,
  );
  requiredElement<HTMLInputElement>("cycle-slider").setAttribute(
    "aria-valuetext",
    cycle === undefined ? "No retained cycles" : `Cycle ${cycle.cycle}`,
  );
  setStage("stage-if", cycle?.fetch ?? null);
  setStage("stage-id", cycle?.decode ?? null);
  setStage("stage-ex", cycle?.execute ?? null);
  setStage("stage-mem", cycle?.memory ?? null);
  setStage("stage-wb", cycle?.writeBack ?? null);
  const event = requiredElement<HTMLElement>("cycle-event");
  event.textContent =
    cycle?.event ??
    (empty
      ? "No cycle-level evidence was retained."
      : "No stall or flush in this cycle.");
  event.dataset.kind = cycle?.event == null ? "quiet" : "hazard";
  const window = Math.floor(currentCycle / TABLE_WINDOW_SIZE);
  if (window !== tableWindow) {
    tableWindow = window;
    renderTable(trace);
  }
  if (cycle !== undefined) highlightTableRow(cycle);
}

/** Bound the DOM to a 100-cycle page while keeping the complete validated trace in memory. */
function renderTable(trace: PipelineTrace): void {
  const body = requiredElement<HTMLTableSectionElement>("trace-rows");
  const fragment = document.createDocumentFragment();
  const start = Math.max(0, tableWindow) * TABLE_WINDOW_SIZE;
  for (const [offset, cycle] of trace.cycles
    .slice(start, start + TABLE_WINDOW_SIZE)
    .entries()) {
    const row = document.createElement("tr");
    row.dataset.cycle = String(cycle.cycle);
    const cell = document.createElement("td");
    const select = document.createElement("button");
    select.type = "button";
    select.textContent = String(cycle.cycle);
    select.setAttribute("aria-label", `Inspect cycle ${cycle.cycle}`);
    select.addEventListener("click", () => navigate(start + offset));
    cell.append(select);
    row.append(cell);
    for (const value of [
      cycle.fetch,
      cycle.decode,
      cycle.execute,
      cycle.memory,
      cycle.writeBack,
    ])
      appendCell(row, stageValue(value));
    appendCell(row, cycle.event ?? "—");
    fragment.append(row);
  }
  body.replaceChildren(fragment);
  setText(
    "trace-window",
    trace.cycles.length === 0
      ? "No retained rows."
      : `Retained rows ${start + 1}–${Math.min(start + TABLE_WINDOW_SIZE, trace.cycles.length)} of ${trace.cycles.length}. Navigate to another cycle to change this bounded table page.`,
  );
}

function renderRegisters(trace: PipelineTrace): void {
  const list = requiredElement<HTMLDListElement>("register-list");
  const fragment = document.createDocumentFragment();
  trace.registers.forEach((value, index) => {
    const term = document.createElement("dt");
    term.textContent = REGISTER_NAMES[index] ?? `$${index}`;
    const definition = document.createElement("dd");
    definition.textContent = `0x${value.toString(16).padStart(8, "0")}`;
    if (value !== 0) {
      definition.dataset.changed = "true";
    }
    fragment.append(term, definition);
  });
  list.replaceChildren(fragment);
}

function setStage(id: string, value: string | null): void {
  const element = requiredElement<HTMLElement>(id);
  element.textContent = stageValue(value);
  element.dataset.bubble = String(value === null);
}

function appendCell(row: HTMLTableRowElement, value: string): void {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
}

function highlightTableRow(cycle: CycleTrace): void {
  for (const row of document.querySelectorAll<HTMLTableRowElement>(
    "#trace-rows tr",
  )) {
    const selected = row.dataset.cycle === String(cycle.cycle);
    row.toggleAttribute("aria-current", selected);
  }
}

function setText(id: string, value: string): void {
  requiredElement<HTMLElement>(id).textContent = value;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Required element #${id} is missing`);
  }
  return element as T;
}

void start();
