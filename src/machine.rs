//! File: Implements the sequential reference interpreter used as the architectural baseline.
//!
//! Major symbols: `Machine`, `RunSummary`, `ExecutionError`, `step`, and `run`.
//! State: registers, program counter, word-addressed memory, halt flag, and retired count.

use crate::assembler::Program;
use crate::isa::{DecodeError, Instruction};
use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{Display, Formatter};

/// Final execution metrics for a bounded interpreter run.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RunSummary {
    pub retired: u64,
    pub final_pc: u32,
}

/// Deterministic failures that can occur while fetching or executing a program.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ExecutionError {
    Decode(DecodeError),
    MisalignedAddress { address: u32, operation: &'static str },
    StepLimitExceeded { limit: u64 },
}

impl Display for ExecutionError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Decode(error) => Display::fmt(error, formatter),
            Self::MisalignedAddress { address, operation } => {
                write!(formatter, "{operation} address 0x{address:08x} is not word-aligned")
            }
            Self::StepLimitExceeded { limit } => {
                write!(formatter, "execution exceeded the configured {limit}-step limit")
            }
        }
    }
}

impl Error for ExecutionError {}

impl From<DecodeError> for ExecutionError {
    fn from(value: DecodeError) -> Self {
        Self::Decode(value)
    }
}

/// A 32-bit word-addressed reference machine with wrapping unsigned arithmetic.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Machine {
    registers: [u32; 32],
    memory: BTreeMap<u32, u32>,
    pc: u32,
    halted: bool,
    retired: u64,
}

impl Machine {
    /// Loads machine words beginning at address zero and resets all architectural state.
    #[must_use]
    pub fn from_program(program: &Program) -> Self {
        let memory = program
            .words
            .iter()
            .enumerate()
            .filter_map(|(index, word)| u32::try_from(index).ok().map(|i| (i * 4, *word)))
            .collect();
        Self { registers: [0; 32], memory, pc: 0, halted: false, retired: 0 }
    }

    /// Executes one instruction and returns it for tracing.
    ///
    /// # Errors
    /// Rejects unknown instruction words and unaligned loads, stores, or fetches.
    pub fn step(&mut self) -> Result<Instruction, ExecutionError> {
        ensure_aligned(self.pc, "instruction fetch")?;
        let word = self.memory.get(&self.pc).copied().unwrap_or(0);
        let instruction = Instruction::decode(word)?;
        let sequential_pc = self.pc.wrapping_add(4);
        let mut next_pc = sequential_pc;

        match instruction {
            Instruction::Nop => {}
            Instruction::Addu { rd, rs, rt } => {
                self.write_register(
                    rd,
                    self.read_register(rs).wrapping_add(self.read_register(rt)),
                );
            }
            Instruction::Subu { rd, rs, rt } => {
                self.write_register(
                    rd,
                    self.read_register(rs).wrapping_sub(self.read_register(rt)),
                );
            }
            Instruction::And { rd, rs, rt } => {
                self.write_register(rd, self.read_register(rs) & self.read_register(rt));
            }
            Instruction::Or { rd, rs, rt } => {
                self.write_register(rd, self.read_register(rs) | self.read_register(rt));
            }
            Instruction::Slt { rd, rs, rt } => {
                let value = u32::from(
                    self.read_register(rs).cast_signed() < self.read_register(rt).cast_signed(),
                );
                self.write_register(rd, value);
            }
            Instruction::Sll { rd, rt, shamt } => {
                self.write_register(rd, self.read_register(rt) << shamt);
            }
            Instruction::Addiu { rt, rs, immediate } => {
                self.write_register(rt, add_signed(self.read_register(rs), immediate));
            }
            Instruction::Lw { rt, base, offset } => {
                let address = add_signed(self.read_register(base), offset);
                ensure_aligned(address, "load")?;
                let value = self.memory.get(&address).copied().unwrap_or(0);
                self.write_register(rt, value);
            }
            Instruction::Sw { rt, base, offset } => {
                let address = add_signed(self.read_register(base), offset);
                ensure_aligned(address, "store")?;
                self.memory.insert(address, self.read_register(rt));
            }
            Instruction::Beq { rs, rt, offset } => {
                if self.read_register(rs) == self.read_register(rt) {
                    next_pc = branch_target(sequential_pc, offset);
                }
            }
            Instruction::Bne { rs, rt, offset } => {
                if self.read_register(rs) != self.read_register(rt) {
                    next_pc = branch_target(sequential_pc, offset);
                }
            }
            Instruction::J { target } => {
                next_pc = (sequential_pc & 0xf000_0000) | (target << 2);
            }
            Instruction::Halt => self.halted = true,
        }

        self.pc = next_pc;
        self.registers[0] = 0;
        self.retired = self.retired.saturating_add(1);
        Ok(instruction)
    }

    /// Runs until `halt` or until the caller-supplied safety bound is reached.
    ///
    /// # Errors
    /// Propagates execution errors and returns `StepLimitExceeded` for non-terminating programs.
    pub fn run(&mut self, max_steps: u64) -> Result<RunSummary, ExecutionError> {
        while !self.halted {
            if self.retired >= max_steps {
                return Err(ExecutionError::StepLimitExceeded { limit: max_steps });
            }
            self.step()?;
        }
        Ok(RunSummary { retired: self.retired, final_pc: self.pc })
    }

    /// Reads one architectural register. Out-of-range indexes are treated as register zero.
    #[must_use]
    pub fn register(&self, index: u8) -> u32 {
        self.registers.get(usize::from(index)).copied().unwrap_or(0)
    }

    /// Reads a word without mutating the sparse memory map; absent words are zero-filled.
    #[must_use]
    pub fn memory_word(&self, address: u32) -> Option<u32> {
        address.is_multiple_of(4).then(|| self.memory.get(&address).copied().unwrap_or(0))
    }

    /// Returns the complete architectural register file for differential tests.
    #[must_use]
    pub const fn registers(&self) -> &[u32; 32] {
        &self.registers
    }

    /// Returns the sparse memory map for differential tests and reports.
    #[must_use]
    pub const fn memory(&self) -> &BTreeMap<u32, u32> {
        &self.memory
    }

    /// Returns the current program counter.
    #[must_use]
    pub const fn pc(&self) -> u32 {
        self.pc
    }

    /// Reports whether the halt instruction has executed.
    #[must_use]
    pub const fn is_halted(&self) -> bool {
        self.halted
    }

    fn read_register(&self, index: u8) -> u32 {
        self.register(index)
    }

    fn write_register(&mut self, index: u8, value: u32) {
        if index != 0
            && let Some(register) = self.registers.get_mut(usize::from(index))
        {
            *register = value;
        }
    }
}

pub(crate) fn add_signed(base: u32, offset: i16) -> u32 {
    base.wrapping_add(i32::from(offset).cast_unsigned())
}

pub(crate) fn branch_target(sequential_pc: u32, offset: i16) -> u32 {
    sequential_pc.wrapping_add(i32::from(offset).cast_unsigned().wrapping_mul(4))
}

pub(crate) const fn ensure_aligned(
    address: u32,
    operation: &'static str,
) -> Result<(), ExecutionError> {
    if address.is_multiple_of(4) {
        Ok(())
    } else {
        Err(ExecutionError::MisalignedAddress { address, operation })
    }
}
