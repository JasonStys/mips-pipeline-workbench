/**
 * File: Renders an accessible, keyboard-operable view of a validated pipeline trace.
 * Major symbols: start, renderSummary, renderCycle, renderTable, and renderRegisters.
 * State: currentCycle stores the selected zero-based trace index; locations are indexed in docs.
 */

import {
  clampCycle,
  parsePipelineTrace,
  stageValue,
  type CycleTrace,
  type PipelineTrace,
} from "./model.js";

const REGISTER_NAMES = [
  "$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3",
  "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
  "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
  "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra",
] as const;

let currentCycle = 0;

/** Loads checked-in evidence, validates it, and wires progressive cycle navigation. */
async function start(): Promise<void> {
  const status = requiredElement<HTMLElement>("status");
  try {
    const response = await fetch("./demo-trace.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Trace request failed with HTTP ${response.status}`);
    }
    const trace = parsePipelineTrace(await response.json());
    renderSummary(trace);
    renderTable(trace);
    renderRegisters(trace);
    configureNavigation(trace);
    renderCycle(trace, 0);
    status.textContent = `Loaded ${trace.cycles.length} retained cycles.`;
  } catch (error: unknown) {
    status.textContent = error instanceof Error ? error.message : "Unable to load the trace.";
    status.dataset.kind = "error";
  }
}

function renderSummary(trace: PipelineTrace): void {
  setText("metric-cycles", String(trace.summary.cycles));
  setText("metric-cpi", trace.summary.cpi.toFixed(2));
  setText("metric-stalls", String(trace.summary.stalls));
  setText("metric-flushes", String(trace.summary.flushes));
}

function configureNavigation(trace: PipelineTrace): void {
  const slider = requiredElement<HTMLInputElement>("cycle-slider");
  const previous = requiredElement<HTMLButtonElement>("previous-cycle");
  const next = requiredElement<HTMLButtonElement>("next-cycle");
  slider.max = String(Math.max(trace.cycles.length - 1, 0));
  slider.addEventListener("input", () => renderCycle(trace, Number(slider.value)));
  previous.addEventListener("click", () => renderCycle(trace, currentCycle - 1));
  next.addEventListener("click", () => renderCycle(trace, currentCycle + 1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      renderCycle(trace, currentCycle - 1);
    } else if (event.key === "ArrowRight") {
      renderCycle(trace, currentCycle + 1);
    }
  });
}

function renderCycle(trace: PipelineTrace, requestedIndex: number): void {
  currentCycle = clampCycle(requestedIndex, trace.cycles.length);
  const cycle = trace.cycles[currentCycle];
  if (cycle === undefined) {
    return;
  }
  requiredElement<HTMLInputElement>("cycle-slider").value = String(currentCycle);
  requiredElement<HTMLButtonElement>("previous-cycle").disabled = currentCycle === 0;
  requiredElement<HTMLButtonElement>("next-cycle").disabled = currentCycle === trace.cycles.length - 1;
  setText("cycle-label", `Cycle ${cycle.cycle} of ${trace.summary.cycles}`);
  setStage("stage-if", cycle.fetch);
  setStage("stage-id", cycle.decode);
  setStage("stage-ex", cycle.execute);
  setStage("stage-mem", cycle.memory);
  setStage("stage-wb", cycle.writeBack);
  const event = requiredElement<HTMLElement>("cycle-event");
  event.textContent = cycle.event ?? "No stall or flush in this cycle.";
  event.dataset.kind = cycle.event === null ? "quiet" : "hazard";
  highlightTableRow(cycle);
}

function renderTable(trace: PipelineTrace): void {
  const body = requiredElement<HTMLTableSectionElement>("trace-rows");
  const fragment = document.createDocumentFragment();
  for (const cycle of trace.cycles) {
    const row = document.createElement("tr");
    row.dataset.cycle = String(cycle.cycle);
    appendCell(row, String(cycle.cycle));
    appendCell(row, stageValue(cycle.fetch));
    appendCell(row, stageValue(cycle.decode));
    appendCell(row, stageValue(cycle.execute));
    appendCell(row, stageValue(cycle.memory));
    appendCell(row, stageValue(cycle.writeBack));
    appendCell(row, cycle.event ?? "—");
    fragment.append(row);
  }
  body.replaceChildren(fragment);
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
  for (const row of document.querySelectorAll<HTMLTableRowElement>("#trace-rows tr")) {
    const selected = row.dataset.cycle === String(cycle.cycle);
    row.toggleAttribute("aria-current", selected);
    if (selected) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
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

