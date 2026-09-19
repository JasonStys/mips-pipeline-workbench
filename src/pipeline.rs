//! File: Implements an independent five-stage in-order pipeline with forwarding and interlocks.
//!
//! Major symbols: `PipelineSimulator`, `PipelineResult`, `PipelineCycle`, and stage helpers.
//! State: architectural registers/memory plus bounded IF/ID, ID/EX, EX/MEM, and MEM/WB latches.

use crate::assembler::Program;
use crate::isa::{DecodeError, Instruction};
use crate::machine::{ExecutionError, add_signed, branch_target, ensure_aligned};
use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{Display, Formatter, Write};

/// One observable cycle with all five stages and any hazard action.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PipelineCycle {
    pub cycle: u64,
    pub fetch: Option<String>,
    pub decode: Option<String>,
    pub execute: Option<String>,
    pub memory: Option<String>,
    pub write_back: Option<String>,
    pub event: Option<String>,
}

/// Final architectural state and timing evidence from a pipeline run.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PipelineResult {
    pub registers: [u32; 32],
    pub memory: BTreeMap<u32, u32>,
    pub final_pc: u32,
    pub retired: u64,
    pub stalls: u64,
    pub flushes: u64,
    pub cycles: Vec<PipelineCycle>,
}

impl PipelineResult {
    /// Returns cycles per retired instruction, or zero when no instruction retired.
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn cpi(&self) -> f64 {
        if self.retired == 0 { 0.0 } else { self.cycles.len() as f64 / self.retired as f64 }
    }

    /// Serializes the bounded trace and summary without adding a runtime JSON dependency.
    #[must_use]
    pub fn to_json(&self) -> String {
        let mut output = String::with_capacity(self.cycles.len().saturating_mul(256));
        let _ = write!(
            output,
            "{{\"schemaVersion\":1,\"summary\":{{\"cycles\":{},\"retired\":{},\"stalls\":{},\"flushes\":{},\"cpi\":{:.4},\"finalPc\":{}}},\"cycles\":[",
            self.cycles.len(),
            self.retired,
            self.stalls,
            self.flushes,
            self.cpi(),
            self.final_pc
        );
        for (index, cycle) in self.cycles.iter().enumerate() {
            if index != 0 {
                output.push(',');
            }
            let _ = write!(output, "{{\"cycle\":{}", cycle.cycle);
            push_json_field(&mut output, "fetch", cycle.fetch.as_deref());
            push_json_field(&mut output, "decode", cycle.decode.as_deref());
            push_json_field(&mut output, "execute", cycle.execute.as_deref());
            push_json_field(&mut output, "memory", cycle.memory.as_deref());
            push_json_field(&mut output, "writeBack", cycle.write_back.as_deref());
            push_json_field(&mut output, "event", cycle.event.as_deref());
            output.push('}');
        }
        output.push_str("],\"registers\":[");
        for (index, value) in self.registers.iter().enumerate() {
            if index != 0 {
                output.push(',');
            }
            let _ = write!(output, "{value}");
        }
        output.push_str("]}");
        output
    }
}

/// Failures are bounded and distinguish decode/execution faults from a cycle limit.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PipelineError {
    Decode(DecodeError),
    Execution(ExecutionError),
    CycleLimitExceeded { limit: u64 },
}

impl Display for PipelineError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Decode(error) => Display::fmt(error, formatter),
            Self::Execution(error) => Display::fmt(error, formatter),
            Self::CycleLimitExceeded { limit } => {
                write!(formatter, "pipeline exceeded the configured {limit}-cycle limit")
            }
        }
    }
}

impl Error for PipelineError {}

impl From<DecodeError> for PipelineError {
    fn from(value: DecodeError) -> Self {
        Self::Decode(value)
    }
}

impl From<ExecutionError> for PipelineError {
    fn from(value: ExecutionError) -> Self {
        Self::Execution(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct StageInstruction {
    pc: u32,
    instruction: Instruction,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ExecuteOutput {
    stage: StageInstruction,
    alu_value: u32,
    store_value: u32,
    destination: Option<u8>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct MemoryOutput {
    stage: StageInstruction,
    value: u32,
    destination: Option<u8>,
}

/// Configurable runner for the classic IF/ID/EX/MEM/WB model.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PipelineSimulator {
    pub max_cycles: u64,
    pub max_trace_cycles: usize,
}

impl Default for PipelineSimulator {
    fn default() -> Self {
        Self { max_cycles: 100_000, max_trace_cycles: 2_000 }
    }
}

impl PipelineSimulator {
    /// Runs an independent pipelined implementation and drains all latches after `halt`.
    ///
    /// # Errors
    /// Rejects invalid instructions, unaligned memory operations, and runs over the cycle bound.
    pub fn run(self, program: &Program) -> Result<PipelineResult, PipelineError> {
        let mut registers = [0_u32; 32];
        let mut memory: BTreeMap<u32, u32> = program
            .words
            .iter()
            .enumerate()
            .filter_map(|(index, word)| u32::try_from(index).ok().map(|i| (i * 4, *word)))
            .collect();
        let mut pc = 0_u32;
        let mut if_id: Option<StageInstruction> = None;
        let mut id_ex: Option<StageInstruction> = None;
        let mut ex_mem: Option<ExecuteOutput> = None;
        let mut mem_wb: Option<MemoryOutput> = None;
        let mut halt_seen = false;
        let mut retired = 0_u64;
        let mut stalls = 0_u64;
        let mut flushes = 0_u64;
        let mut cycles = Vec::new();

        for cycle_number in 1..=self.max_cycles {
            if let Some(write_back) = mem_wb {
                if let Some(destination) = write_back.destination {
                    registers[usize::from(destination)] = write_back.value;
                }
                retired = retired.saturating_add(1);
            }
            registers[0] = 0;

            let next_mem_wb = match ex_mem {
                Some(output) => Some(memory_stage(output, &mut memory)?),
                None => None,
            };

            let execution = id_ex.map(|stage| execute_stage(stage, &registers, ex_mem, mem_wb));
            let next_ex_mem = execution.map(|value| value.0);
            let control_target = execution.and_then(|value| value.1);
            let executing_halt =
                matches!(id_ex.map(|stage| stage.instruction), Some(Instruction::Halt));
            let load_stall = has_load_use_hazard(id_ex, if_id);

            let mut event = None;
            let (next_if_id, next_id_ex, fetched) = if executing_halt {
                halt_seen = true;
                let discarded = u64::from(if_id.is_some()) + 1;
                flushes = flushes.saturating_add(discarded);
                event = Some("halt: younger instructions flushed".to_owned());
                (None, None, None)
            } else if let Some(target) = control_target {
                let discarded = u64::from(if_id.is_some()) + 1;
                flushes = flushes.saturating_add(discarded);
                pc = target;
                event = Some(format!("control hazard: flushed {discarded} slot(s)"));
                (None, None, None)
            } else if load_stall {
                stalls = stalls.saturating_add(1);
                event = Some("load-use interlock: inserted one bubble".to_owned());
                (if_id, None, None)
            } else if halt_seen {
                (None, None, None)
            } else {
                ensure_aligned(pc, "instruction fetch")?;
                let word = memory.get(&pc).copied().unwrap_or(0);
                let instruction = Instruction::decode(word)?;
                let fetched_stage = StageInstruction { pc, instruction };
                pc = pc.wrapping_add(4);
                (Some(fetched_stage), if_id, Some(fetched_stage))
            };

            if cycles.len() < self.max_trace_cycles {
                cycles.push(PipelineCycle {
                    cycle: cycle_number,
                    fetch: fetched.map(stage_label),
                    decode: if_id.map(stage_label),
                    execute: id_ex.map(stage_label),
                    memory: ex_mem.map(|value| stage_label(value.stage)),
                    write_back: mem_wb.map(|value| stage_label(value.stage)),
                    event,
                });
            }

            mem_wb = next_mem_wb;
            ex_mem = next_ex_mem;
            id_ex = next_id_ex;
            if_id = next_if_id;

            if halt_seen
                && if_id.is_none()
                && id_ex.is_none()
                && ex_mem.is_none()
                && mem_wb.is_none()
            {
                return Ok(PipelineResult {
                    registers,
                    memory,
                    final_pc: pc,
                    retired,
                    stalls,
                    flushes,
                    cycles,
                });
            }
        }

        Err(PipelineError::CycleLimitExceeded { limit: self.max_cycles })
    }
}

fn memory_stage(
    output: ExecuteOutput,
    memory: &mut BTreeMap<u32, u32>,
) -> Result<MemoryOutput, ExecutionError> {
    let value = match output.stage.instruction {
        Instruction::Lw { .. } => {
            ensure_aligned(output.alu_value, "load")?;
            memory.get(&output.alu_value).copied().unwrap_or(0)
        }
        Instruction::Sw { .. } => {
            ensure_aligned(output.alu_value, "store")?;
            memory.insert(output.alu_value, output.store_value);
            0
        }
        _ => output.alu_value,
    };
    Ok(MemoryOutput { stage: output.stage, value, destination: output.destination })
}

fn execute_stage(
    stage: StageInstruction,
    registers: &[u32; 32],
    ex_mem: Option<ExecuteOutput>,
    mem_wb: Option<MemoryOutput>,
) -> (ExecuteOutput, Option<u32>) {
    let read = |index: u8| forwarded_value(index, registers, ex_mem, mem_wb);
    let mut control_target = None;
    let (alu_value, store_value) = match stage.instruction {
        Instruction::Nop | Instruction::Halt => (0, 0),
        Instruction::Addu { rs, rt, .. } => (read(rs).wrapping_add(read(rt)), 0),
        Instruction::Subu { rs, rt, .. } => (read(rs).wrapping_sub(read(rt)), 0),
        Instruction::And { rs, rt, .. } => (read(rs) & read(rt), 0),
        Instruction::Or { rs, rt, .. } => (read(rs) | read(rt), 0),
        Instruction::Slt { rs, rt, .. } => {
            (u32::from(read(rs).cast_signed() < read(rt).cast_signed()), 0)
        }
        Instruction::Sll { rt, shamt, .. } => (read(rt) << shamt, 0),
        Instruction::Addiu { rs, immediate, .. } => (add_signed(read(rs), immediate), 0),
        Instruction::Lw { base, offset, .. } => (add_signed(read(base), offset), 0),
        Instruction::Sw { rt, base, offset } => (add_signed(read(base), offset), read(rt)),
        Instruction::Beq { rs, rt, offset } => {
            if read(rs) == read(rt) {
                control_target = Some(branch_target(stage.pc.wrapping_add(4), offset));
            }
            (0, 0)
        }
        Instruction::Bne { rs, rt, offset } => {
            if read(rs) != read(rt) {
                control_target = Some(branch_target(stage.pc.wrapping_add(4), offset));
            }
            (0, 0)
        }
        Instruction::J { target } => {
            control_target = Some((stage.pc.wrapping_add(4) & 0xf000_0000) | (target << 2));
            (0, 0)
        }
    };

    (
        ExecuteOutput {
            stage,
            alu_value,
            store_value,
            destination: stage.instruction.destination_register(),
        },
        control_target,
    )
}

fn forwarded_value(
    register: u8,
    registers: &[u32; 32],
    ex_mem: Option<ExecuteOutput>,
    mem_wb: Option<MemoryOutput>,
) -> u32 {
    if register == 0 {
        return 0;
    }
    if let Some(output) = ex_mem
        && !output.stage.instruction.is_load()
        && output.destination == Some(register)
    {
        return output.alu_value;
    }
    if let Some(output) = mem_wb
        && output.destination == Some(register)
    {
        return output.value;
    }
    registers.get(usize::from(register)).copied().unwrap_or(0)
}

fn has_load_use_hazard(id_ex: Option<StageInstruction>, if_id: Option<StageInstruction>) -> bool {
    let Some(load) = id_ex.filter(|stage| stage.instruction.is_load()) else {
        return false;
    };
    let Some(destination) = load.instruction.destination_register() else {
        return false;
    };
    if_id.is_some_and(|stage| {
        stage
            .instruction
            .source_registers()
            .into_iter()
            .flatten()
            .any(|source| source == destination)
    })
}

fn stage_label(stage: StageInstruction) -> String {
    format!("0x{:08x}: {}", stage.pc, stage.instruction.disassemble())
}

fn push_json_field(output: &mut String, key: &str, value: Option<&str>) {
    let _ = write!(output, ",\"{key}\":");
    match value {
        Some(value) => {
            output.push('"');
            for character in value.chars() {
                match character {
                    '"' => output.push_str("\\\""),
                    '\\' => output.push_str("\\\\"),
                    '\n' => output.push_str("\\n"),
                    '\r' => output.push_str("\\r"),
                    '\t' => output.push_str("\\t"),
                    other if other.is_control() => {
                        let _ = write!(output, "\\u{:04x}", u32::from(other));
                    }
                    other => output.push(other),
                }
            }
            output.push('"');
        }
        None => output.push_str("null"),
    }
}
