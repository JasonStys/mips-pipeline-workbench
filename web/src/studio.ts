/**
 * File: Connects editable assembly/cache experiments and durable history to the owned native Rust API.
 * Major symbols: startStudio, api, execute, adoptEvidence and history; exact lines: docs/code-index.md.
 * State: an ephemeral per-tab capability, generation counters, one selected result and bounded pages.
 * Imported report contents are never trusted as execution proof; only their input is rerun.
 */
import { parseTraceText } from "./import.js";
import type { PipelineTrace } from "./model.js";

type Input =
  | {
      kind: "execution";
      source: string;
      maxCycles: number;
      retainedCycles: number;
    }
  | {
      kind: "cache";
      sets: number;
      ways: number;
      lineBytes: number;
      addresses: number[];
    };
interface Evidence {
  id: string;
  title: string;
  created: string;
  input: Input;
  report: Record<string, unknown>;
  engine: { sourceCommit: string; sha256: string };
}
interface Page {
  page: number;
  pageSize: number;
  total: number;
  items: {
    id: string;
    title: string;
    kind: string;
    status: string;
    created: string;
  }[];
}
let capability = "";
let selected: Evidence | undefined;
let revision = 0;
let historyGeneration = 0;
let busy = false;
let page = 0;
let historyBounds = { page: 0, pageSize: 25, total: 0 };
let adoptTrace: (trace: PipelineTrace, source: string) => void;

/** Required static controls are application code, never names supplied by imported evidence. */
function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing native control ${id}`);
  return node as T;
}

/** Render all untrusted text as textContent; code and labels never become HTML. */
function message(value: string): void {
  element("studio-status").textContent = value;
}

/** Same-origin requests use only the current owner's unguessable capability, never cookies or URLs. */
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    headers: {
      "X-Mips-Capability": capability,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const result = (await response.json()) as {
    error?: string;
    diagnostic?: { phase: string; line: number | null; message: string };
  };
  if (!response.ok) {
    const d = result.diagnostic;
    throw new Error(
      d === undefined
        ? (result.error ?? `HTTP ${response.status}`)
        : `${d.phase}${d.line === null ? " (line unknown)" : ` at source line ${d.line}`}: ${d.message}`,
    );
  }
  return result as T;
}

/** Wire real native workflows only when launched by its owner; the static trace explorer still works. */
export async function startStudio(adopt: typeof adoptTrace): Promise<void> {
  adoptTrace = adopt;
  const token = new URLSearchParams(location.hash.slice(1)).get("native");
  if (token !== null && /^[A-Za-z0-9_-]{40,60}$/u.test(token)) {
    capability = token;
    sessionStorage.setItem("mips-native", capability);
    history.replaceState(null, "", location.pathname);
  } else capability = sessionStorage.getItem("mips-native") ?? "";
  if (capability === "") return;
  try {
    await api<Page>("/api/history");
    element("native-studio").hidden = false;
    element("standalone-note").hidden = true;
    for (const control of document.querySelectorAll(
      "#native-studio input,#native-studio textarea,#native-studio select",
    )) {
      control.addEventListener("input", () => {
        revision++;
      });
    }
    element("assembly-form").addEventListener("submit", (e) => {
      e.preventDefault();
      void execute(executionInput());
    });
    element("cache-form").addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        void execute(cacheInput());
      } catch (error) {
        message(error instanceof Error ? error.message : "Invalid cache input");
      }
    });
    element<HTMLInputElement>("assembly-file").addEventListener(
      "change",
      (e) => void importAssembly(e),
    );
    element<HTMLInputElement>("experiment-file").addEventListener(
      "change",
      (e) => void importExperiment(e),
    );
    element("export-experiment").addEventListener("click", exportEvidence);
    element("history-form").addEventListener("submit", (e) => {
      e.preventDefault();
      page = 0;
      void loadHistory();
    });
    element("history-previous").addEventListener("click", () => {
      if (page > 0) page--;
      void loadHistory();
    });
    element("history-next").addEventListener("click", () => {
      page++;
      void loadHistory();
    });
    element("delete-experiment").addEventListener(
      "click",
      () => void deleteEvidence(),
    );
    element("quit-studio").addEventListener("click", () => void quit());
    await loadHistory();
    message(
      "Native Rust engine connected. Edit assembly or choose an independent cache experiment. Nothing is executed on your host CPU as submitted code.",
    );
  } catch {
    sessionStorage.removeItem("mips-native");
    message(
      "Native session is no longer available. Use Open in the native owner window. Your saved workspace is retained.",
    );
  }
}

function executionInput(): Input {
  return {
    kind: "execution",
    source: element<HTMLTextAreaElement>("assembly-source").value,
    maxCycles: element<HTMLInputElement>("max-cycles").valueAsNumber,
    retainedCycles: element<HTMLInputElement>("retained-cycles").valueAsNumber,
  };
}
function cacheInput(): Input {
  const words = element<HTMLTextAreaElement>("cache-addresses")
    .value.trim()
    .split(/[\s,]+/u)
    .filter(Boolean);
  if (
    words.length > 10000 ||
    words.some((word) => !/^(?:0x[\da-f]+|\d+)$/iu.test(word))
  )
    throw new Error(
      "Use at most 10000 decimal or 0x hexadecimal byte addresses.",
    );
  const addresses = words.map(Number);
  if (
    addresses.some(
      (value) =>
        !Number.isSafeInteger(value) || value < 0 || value > 0xffffffff,
    )
  )
    throw new Error("Addresses must fit unsigned 32-bit bytes.");
  return {
    kind: "cache",
    sets: element<HTMLInputElement>("cache-sets").valueAsNumber,
    ways: element<HTMLInputElement>("cache-ways").valueAsNumber,
    lineBytes: element<HTMLInputElement>("cache-line").valueAsNumber,
    addresses,
  };
}

/** One submitted revision owns its UI response. New edits cannot be overwritten by a slower run. */
async function execute(input: Input): Promise<void> {
  if (busy) return;
  const captured = revision;
  setBusy(true);
  message("Running the actual Rust model; waiting for its complete result…");
  try {
    const evidence = await api<Evidence>("/api/run", {
      title: element<HTMLInputElement>("experiment-title").value,
      input,
    });
    if (captured === revision) adoptEvidence(evidence);
    else
      message(
        "Completed evidence was saved in history. Newer edits were retained; select that history row to inspect it.",
      );
    await loadHistory();
  } catch (error) {
    message(
      `${error instanceof Error ? error.message : "Experiment failed"}. Prior accepted evidence is unchanged.`,
    );
  } finally {
    setBusy(false);
  }
}

function setBusy(value: boolean): void {
  busy = value;
  for (const node of document.querySelectorAll<HTMLButtonElement>(
    "#native-studio button[data-work]",
  ))
    node.disabled = value;
  element<HTMLButtonElement>("export-experiment").disabled =
    value || selected === undefined;
  element<HTMLButtonElement>("delete-experiment").disabled =
    value || selected === undefined;
  element<HTMLButtonElement>("history-previous").disabled =
    value || historyBounds.page === 0;
  element<HTMLButtonElement>("history-next").disabled =
    value ||
    (historyBounds.page + 1) * historyBounds.pageSize >= historyBounds.total;
}

/** Present actual comparison, source listing and memory; mismatch cannot receive a verified label. */
function adoptEvidence(evidence: Evidence): void {
  selected = evidence;
  element<HTMLInputElement>("experiment-title").value = evidence.title;
  const input = evidence.input;
  if (input.kind === "execution") {
    element<HTMLTextAreaElement>("assembly-source").value = input.source;
    element<HTMLInputElement>("max-cycles").value = String(input.maxCycles);
    element<HTMLInputElement>("retained-cycles").value = String(
      input.retainedCycles,
    );
    const trace = parseTraceText(JSON.stringify(evidence.report.trace));
    adoptTrace(
      trace,
      `Native Rust execution ${evidence.id}; ${String(evidence.report.status)}`,
    );
  } else {
    element<HTMLTextAreaElement>("cache-addresses").value =
      input.addresses.join(", ");
    element<HTMLInputElement>("cache-sets").value = String(input.sets);
    element<HTMLInputElement>("cache-ways").value = String(input.ways);
    element<HTMLInputElement>("cache-line").value = String(input.lineBytes);
  }
  const report = evidence.report;
  element("comparison").textContent =
    input.kind === "execution"
      ? report.status === "verified"
        ? "Verified: all 32 registers, sparse memory, architectural Halt PC and retired count agree between the independent Rust models."
        : "MODEL MISMATCH: reference and pipeline states differ. This experiment is retained as discrepancy evidence, not verified output."
      : `Independent LRU experiment: ${String(report.hits)} hits / ${String(report.misses)} misses over ${String(report.accesses)} accesses. Not a measured hardware cache or pipeline-derived address stream.`;
  element("evidence-provenance").textContent =
    `Selected ${evidence.title} · ${evidence.created} · source ${evidence.engine.sourceCommit} · Rust SHA256 ${evidence.engine.sha256}`;
  element("source-listing").textContent = JSON.stringify(
    report.listing ?? report.observations,
    null,
    2,
  );
  element("reference-state").textContent = JSON.stringify(
    report.reference ?? report.config,
    null,
    2,
  );
  element("memory-state").textContent = JSON.stringify(
    report.pipelineMemory ?? { hitRatio: report.hitRatio },
    null,
    2,
  );
  element<HTMLInputElement>("confirm-delete").checked = false;
  message(
    `Selected saved ${input.kind} evidence. Export preserves its exact input, engine identity and result.`,
  );
  setBusy(busy);
}

/** Query-relative pagination is reset by a new filter; stale async search results cannot replace it. */
async function loadHistory(): Promise<void> {
  const generation = ++historyGeneration;
  const query = new URLSearchParams({
    q: element<HTMLInputElement>("history-query").value,
    kind: element<HTMLSelectElement>("history-kind").value,
    page: String(page),
  });
  try {
    const result = await api<Page>(`/api/history?${query}`);
    if (generation !== historyGeneration) return;
    historyBounds = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
    const fragment = document.createDocumentFragment();
    for (const row of result.items) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.work = "";
      button.disabled = busy;
      button.textContent = `${row.title} · ${row.kind} · ${row.status}`;
      button.addEventListener("click", () => void selectEvidence(row.id));
      item.append(button);
      fragment.append(item);
    }
    element("history-list").replaceChildren(fragment);
    element("history-count").textContent =
      `${result.total} matching records · page ${result.page + 1}`;
    element<HTMLButtonElement>("history-previous").disabled =
      busy || result.page === 0;
    element<HTMLButtonElement>("history-next").disabled =
      busy || (result.page + 1) * result.pageSize >= result.total;
  } catch (error) {
    if (generation === historyGeneration)
      message(
        error instanceof Error ? error.message : "Unable to read history",
      );
  }
}
async function selectEvidence(id: string): Promise<void> {
  if (busy) return;
  const captured = ++revision;
  setBusy(true);
  try {
    const record = await api<Evidence>(`/api/history/${id}`);
    if (captured === revision) adoptEvidence(record);
  } catch (error) {
    message(
      error instanceof Error
        ? error.message
        : "Unable to open selected evidence",
    );
  } finally {
    setBusy(false);
  }
}

/** Export the captured selected record, never newer edits or a refreshed unrelated history row. */
function exportEvidence(): void {
  if (selected === undefined || busy) return;
  const record = selected;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `mips-${record.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
async function importAssembly(event: Event): Promise<void> {
  const control = event.currentTarget as HTMLInputElement;
  const file = control.files?.[0];
  if (file === undefined) return;
  const captured = ++revision;
  try {
    if (file.size > 128 * 1024) throw new Error("Assembly exceeds 128 KiB");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    if (captured === revision) {
      element<HTMLTextAreaElement>("assembly-source").value = text;
      message(
        "Assembly imported for editing. Choose Run assembly to execute the actual models.",
      );
    }
  } catch (error) {
    message(
      error instanceof Error ? error.message : "Unable to read UTF-8 assembly",
    );
  } finally {
    control.value = "";
  }
}
async function importExperiment(event: Event): Promise<void> {
  const control = event.currentTarget as HTMLInputElement;
  const file = control.files?.[0];
  if (file === undefined) return;
  if (busy) {
    control.value = "";
    message(
      "Wait for the active experiment before importing another saved input.",
    );
    return;
  }
  const captured = ++revision;
  try {
    if (file.size > 8 * 1024 * 1024)
      throw new Error("Experiment exceeds 8 MiB");
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      ),
    ) as { product?: string; input?: Input; title?: string };
    if (
      value.product !== "mips-pipeline-workbench" ||
      value.input === undefined ||
      typeof value.title !== "string"
    )
      throw new Error("Choose an exported MIPS experiment");
    if (captured !== revision) return;
    element<HTMLInputElement>("experiment-title").value = value.title;
    await execute(value.input);
  } catch (error) {
    message(
      `${error instanceof Error ? error.message : "Invalid experiment"}. Imported report claims were not trusted.`,
    );
  } finally {
    control.value = "";
  }
}
async function deleteEvidence(): Promise<void> {
  if (selected === undefined || busy) return;
  if (!element<HTMLInputElement>("confirm-delete").checked) {
    message(
      "Select the explicit deletion confirmation first. Export the selected evidence if needed.",
    );
    return;
  }
  const id = selected.id;
  setBusy(true);
  try {
    await api("/api/delete", { id });
    selected = undefined;
    page = 0;
    await loadHistory();
    message(
      "Selected saved record deleted. Current source and displayed trace remain available.",
    );
  } catch (error) {
    message(error instanceof Error ? error.message : "Deletion failed");
  } finally {
    setBusy(false);
  }
}
async function quit(): Promise<void> {
  if (busy) {
    message(
      "Wait for the active experiment, or use Exit in the native owner window; ownership is retained while it drains.",
    );
    return;
  }
  try {
    await api("/api/quit", { quit: true });
    message(
      "Closing the owned app after pending work completes. Saved history is retained.",
    );
  } catch (error) {
    message(
      error instanceof Error
        ? error.message
        : "Use Exit in the native owner window",
    );
  }
}
