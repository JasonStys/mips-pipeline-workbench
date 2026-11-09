/**
 * File: Bounds local trace bytes and decodes UTF-8 before strict schema validation.
 * Major symbols: MAX_TRACE_BYTES, parseTraceText and readTraceFile; see docs/code-index.md.
 * State: no upload, storage or code execution; a failed import leaves the active trace untouched.
 */
import { parsePipelineTrace, type PipelineTrace } from "./model.js";

export const MAX_TRACE_BYTES = 8 * 1024 * 1024;

/** Parse JSON only after an encoded-size check, with a useful error distinct from schema failures. */
export function parseTraceText(text: string): PipelineTrace {
  if (new TextEncoder().encode(text).byteLength > MAX_TRACE_BYTES) {
    throw new Error("Trace exceeds the 8 MiB local import limit.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      "Trace is not valid JSON. Export a version-one JSON trace from the Rust CLI.",
    );
  }
  return parsePipelineTrace(value);
}

/** Check both advertised and actual byte lengths; reject malformed UTF-8 rather than replacing data. */
export async function readTraceFile(
  file: Pick<File, "size" | "arrayBuffer">,
): Promise<PipelineTrace> {
  if (
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > MAX_TRACE_BYTES
  ) {
    throw new Error("Choose a nonempty trace JSON file no larger than 8 MiB.");
  }
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength !== file.size || bytes.byteLength > MAX_TRACE_BYTES) {
    throw new Error("Trace size changed while reading; choose the file again.");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Trace must contain valid UTF-8 text.");
  }
  return parseTraceText(text);
}
