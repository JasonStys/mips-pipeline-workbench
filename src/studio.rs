//! File: Runs bounded native-studio execution and cache experiments using the original engines.
//!
//! Major symbols: `ExecutionConfig`, `ExecutionReport`, `StudioError`, `analyze`, and `cache_report`.
//! State: one owned assembled program, independent reference/pipeline states and transient LRU counters.
//! Physical declarations are indexed in `docs/code-index.md`; no host code, device or network executes.

use crate::{
    CacheConfig, Machine, PipelineResult, PipelineSimulator, Program, SetAssociativeCache, assemble,
};
use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{Display, Formatter, Write};

/// Hard budgets apply to both CLI and native GUI callers, before model allocation/execution.
pub const MAX_SOURCE_BYTES: usize = 128 * 1024;
/// A small executable program fits the educational trace/listing interface.
pub const MAX_PROGRAM_WORDS: usize = 4096;
/// Neither reference steps nor pipeline cycles may exceed this studio budget.
pub const MAX_CYCLES: u64 = 10_000;
/// Cache experiments have an independent bounded address sequence.
pub const MAX_CACHE_ACCESSES: usize = 10_000;

/// Execution and retained-evidence budgets; retained cycles do not alter architectural completion.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ExecutionConfig {
    pub max_cycles: u64,
    pub retained_cycles: usize,
}

/// A source-aware failure is a diagnostic, never a verified execution report.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StudioError {
    pub phase: &'static str,
    pub line: Option<usize>,
    pub message: String,
}

impl Display for StudioError {
    fn fmt(&self, output: &mut Formatter<'_>) -> std::fmt::Result {
        write!(output, "{}: {}", self.phase, self.message)
    }
}

impl Error for StudioError {}

impl StudioError {
    /// Encode a diagnostic with explicit unknown line rather than inventing a source location.
    #[must_use]
    pub fn to_json(&self) -> String {
        let line = self.line.map_or_else(|| "null".to_owned(), |line| line.to_string());
        let kind = if self.phase == "cache" { "cache" } else { "execution" };
        format!(
            "{{\"schemaVersion\":1,\"kind\":\"{kind}\",\"status\":\"error\",\"phase\":\"{}\",\"line\":{},\"message\":\"{}\"}}",
            self.phase,
            line,
            escaped(&self.message)
        )
    }
}

/// Actual results retain both independent models, not merely a Boolean success label.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecutionReport {
    pub program: Program,
    pub reference_registers: [u32; 32],
    pub reference_memory: BTreeMap<u32, u32>,
    pub reference_pc: u32,
    pub reference_retired: u64,
    pub pipeline: PipelineResult,
}

impl ExecutionReport {
    /// Require every architectural field to agree; trace/CPI are separate timing-model evidence.
    #[must_use]
    pub fn equivalent(&self) -> bool {
        self.reference_registers == self.pipeline.registers
            && self.reference_memory == self.pipeline.memory
            && self.reference_pc == self.pipeline.final_pc
            && self.reference_retired == self.pipeline.retired
    }

    /// Serialize the actual listing and both states; mismatch is explicit and cannot be called verified.
    #[must_use]
    pub fn to_json(&self) -> String {
        let equivalent = self.equivalent();
        let mut output = format!(
            "{{\"schemaVersion\":1,\"kind\":\"execution\",\"status\":\"{}\",\"equivalent\":{},\"reference\":{{\"registers\":{:?},\"finalPc\":{},\"retired\":{},\"memory\":{} }},\"pipelineMemory\":{},\"trace\":{},\"listing\":[",
            if equivalent { "verified" } else { "mismatch" },
            equivalent,
            self.reference_registers,
            self.reference_pc,
            self.reference_retired,
            memory_json(&self.reference_memory),
            memory_json(&self.pipeline.memory),
            self.pipeline.to_json(),
        );
        let mut address = 0_u32;
        for (index, (&word, &line)) in
            self.program.words.iter().zip(&self.program.source_lines).enumerate()
        {
            if index > 0 {
                output.push(',');
            }
            let _ = write!(output, "{{\"address\":{address},\"word\":{word},\"line\":{line}}}");
            address = address.wrapping_add(4);
        }
        output.push_str("]}");
        output
    }
}

/// Assemble and independently execute a bounded educational source; never run native submitted code.
///
/// # Errors
/// Reject invalid bounds/source, precise assembler faults and reference/pipeline execution failures.
pub fn analyze(source: &str, config: ExecutionConfig) -> Result<ExecutionReport, StudioError> {
    if source.trim().is_empty()
        || source.len() > MAX_SOURCE_BYTES
        || config.max_cycles == 0
        || config.max_cycles > MAX_CYCLES
        || config.retained_cycles > 10_000
    {
        return Err(fault(
            "input",
            None,
            "Source or execution budget is outside the documented studio bounds",
        ));
    }
    let program =
        assemble(source).map_err(|error| fault("assembly", Some(error.line), error.message))?;
    if program.words.is_empty() || program.words.len() > MAX_PROGRAM_WORDS {
        return Err(fault("assembly", None, "Provide between 1 and 4096 executable words"));
    }
    let mut reference = Machine::from_program(&program);
    let summary = reference.run(config.max_cycles).map_err(|error| {
        let line = usize::try_from(reference.pc() / 4)
            .ok()
            .and_then(|index| program.source_lines.get(index))
            .copied();
        fault("reference", line, error.to_string())
    })?;
    let pipeline = PipelineSimulator {
        max_cycles: config.max_cycles,
        max_trace_cycles: config.retained_cycles,
    }
    .run(&program)
    .map_err(|error| fault("pipeline", None, error.to_string()))?;
    Ok(ExecutionReport {
        program,
        reference_registers: *reference.registers(),
        reference_memory: reference.memory().clone(),
        reference_pc: summary.final_pc,
        reference_retired: summary.retired,
        pipeline,
    })
}

/// Execute the original LRU model on byte addresses; these are not inferred pipeline accesses.
///
/// # Errors
/// Reject excessive shapes/sequences and invalid non-power-of-two line sizes before allocation.
pub fn cache_report(config: CacheConfig, addresses: &[u32]) -> Result<String, StudioError> {
    if config.sets > 64
        || config.ways > 8
        || config.line_bytes > 256
        || addresses.len() > MAX_CACHE_ACCESSES
    {
        return Err(fault("cache", None, "Cache shape or address count exceeds the studio budget"));
    }
    let mut cache = SetAssociativeCache::new(config)
        .map_err(|error| fault("cache", None, error.to_string()))?;
    let mut observations = String::new();
    for (index, &address) in addresses.iter().enumerate() {
        if index > 0 {
            observations.push(',');
        }
        let hit = cache.access(address);
        let _ = write!(observations, "{{\"address\":{address},\"hit\":{hit}}}");
    }
    let stats = cache.stats();
    Ok(format!(
        "{{\"schemaVersion\":1,\"kind\":\"cache\",\"status\":\"completed\",\"config\":{{\"sets\":{},\"ways\":{},\"lineBytes\":{}}},\"accesses\":{},\"hits\":{},\"misses\":{},\"hitRatio\":{},\"observations\":[{}]}}",
        config.sets,
        config.ways,
        config.line_bytes,
        stats.accesses,
        stats.hits,
        stats.misses,
        stats.hit_ratio(),
        observations
    ))
}

/// Retain stable sparse numeric memory without adding a second serializer/dependency to the kernel.
fn memory_json(memory: &BTreeMap<u32, u32>) -> String {
    let mut output = "[".to_owned();
    for (index, (&address, &word)) in memory.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        let _ = write!(output, "{{\"address\":{address},\"word\":{word}}}");
    }
    output.push(']');
    output
}

/// Escape diagnostic text completely, including user-supplied quote/control characters.
fn escaped(value: &str) -> String {
    let mut output = String::new();
    for character in value.chars() {
        match character {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            item if item < '\u{20}' => {
                let _ = write!(output, "\\u{:04x}", u32::from(item));
            }
            item => output.push(item),
        }
    }
    output
}

/// Keep phase and physical source line independent of presentation/error-string parsing.
fn fault(phase: &'static str, line: Option<usize>, message: impl Into<String>) -> StudioError {
    StudioError { phase, line, message: message.into() }
}
