//! File: Defines the supported MIPS-like instruction subset and its binary encoding.
//!
//! Major symbols: `Instruction`, `DecodeError`, `register_name`, and register metadata.
//! State: instructions are immutable values; exact declaration lines live in `docs/code-index.md`.

use std::error::Error;
use std::fmt::{Display, Formatter};

/// Conventional names for all 32 general-purpose registers.
pub const REGISTER_NAMES: [&str; 32] = [
    "$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3", "$t0", "$t1", "$t2", "$t3", "$t4",
    "$t5", "$t6", "$t7", "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7", "$t8", "$t9",
    "$k0", "$k1", "$gp", "$sp", "$fp", "$ra",
];

/// An intentionally small, documented MIPS32-inspired instruction subset.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Instruction {
    Nop,
    Addu { rd: u8, rs: u8, rt: u8 },
    Subu { rd: u8, rs: u8, rt: u8 },
    And { rd: u8, rs: u8, rt: u8 },
    Or { rd: u8, rs: u8, rt: u8 },
    Slt { rd: u8, rs: u8, rt: u8 },
    Sll { rd: u8, rt: u8, shamt: u8 },
    Addiu { rt: u8, rs: u8, immediate: i16 },
    Lw { rt: u8, base: u8, offset: i16 },
    Sw { rt: u8, base: u8, offset: i16 },
    Beq { rs: u8, rt: u8, offset: i16 },
    Bne { rs: u8, rt: u8, offset: i16 },
    J { target: u32 },
    Halt,
}

/// A decoding failure with the original machine word preserved for diagnostics.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DecodeError {
    pub word: u32,
}

impl Display for DecodeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "unsupported instruction word 0x{:08x}", self.word)
    }
}

impl Error for DecodeError {}

/// Returns the conventional name for a register index, or `$invalid` outside 0..32.
#[must_use]
pub fn register_name(index: u8) -> &'static str {
    REGISTER_NAMES.get(usize::from(index)).copied().unwrap_or("$invalid")
}

impl Instruction {
    /// Decodes one 32-bit machine word.
    ///
    /// # Errors
    /// Unknown opcodes and function codes are rejected without executing the word.
    pub const fn decode(word: u32) -> Result<Self, DecodeError> {
        if word == 0 {
            return Ok(Self::Nop);
        }
        let opcode = ((word >> 26) & 0x3f) as u8;
        let rs = ((word >> 21) & 0x1f) as u8;
        let rt = ((word >> 16) & 0x1f) as u8;
        let rd = ((word >> 11) & 0x1f) as u8;
        let shamt = ((word >> 6) & 0x1f) as u8;
        let bytes = word.to_le_bytes();
        let immediate = i16::from_le_bytes([bytes[0], bytes[1]]);
        let function = (word & 0x3f) as u8;

        match (opcode, function) {
            (0x00, 0x21) => Ok(Self::Addu { rd, rs, rt }),
            (0x00, 0x23) => Ok(Self::Subu { rd, rs, rt }),
            (0x00, 0x24) => Ok(Self::And { rd, rs, rt }),
            (0x00, 0x25) => Ok(Self::Or { rd, rs, rt }),
            (0x00, 0x2a) => Ok(Self::Slt { rd, rs, rt }),
            (0x00, 0x00) => Ok(Self::Sll { rd, rt, shamt }),
            (0x09, _) => Ok(Self::Addiu { rt, rs, immediate }),
            (0x23, _) => Ok(Self::Lw { rt, base: rs, offset: immediate }),
            (0x2b, _) => Ok(Self::Sw { rt, base: rs, offset: immediate }),
            (0x04, _) => Ok(Self::Beq { rs, rt, offset: immediate }),
            (0x05, _) => Ok(Self::Bne { rs, rt, offset: immediate }),
            (0x02, _) => Ok(Self::J { target: word & 0x03ff_ffff }),
            (0x3f, 0x00) => Ok(Self::Halt),
            _ => Err(DecodeError { word }),
        }
    }

    /// Encodes the instruction into one fixed-width machine word.
    #[must_use]
    pub fn encode(self) -> u32 {
        match self {
            Self::Nop => 0,
            Self::Addu { rd, rs, rt } => encode_r(rs, rt, rd, 0, 0x21),
            Self::Subu { rd, rs, rt } => encode_r(rs, rt, rd, 0, 0x23),
            Self::And { rd, rs, rt } => encode_r(rs, rt, rd, 0, 0x24),
            Self::Or { rd, rs, rt } => encode_r(rs, rt, rd, 0, 0x25),
            Self::Slt { rd, rs, rt } => encode_r(rs, rt, rd, 0, 0x2a),
            Self::Sll { rd, rt, shamt } => encode_r(0, rt, rd, shamt, 0x00),
            Self::Addiu { rt, rs, immediate } => encode_i(0x09, rs, rt, immediate),
            Self::Lw { rt, base, offset } => encode_i(0x23, base, rt, offset),
            Self::Sw { rt, base, offset } => encode_i(0x2b, base, rt, offset),
            Self::Beq { rs, rt, offset } => encode_i(0x04, rs, rt, offset),
            Self::Bne { rs, rt, offset } => encode_i(0x05, rs, rt, offset),
            Self::J { target } => (0x02_u32 << 26) | (target & 0x03ff_ffff),
            Self::Halt => 0x3f_u32 << 26,
        }
    }

    /// Lists registers read by this instruction for hazard detection.
    #[must_use]
    pub const fn source_registers(self) -> [Option<u8>; 2] {
        match self {
            Self::Addu { rs, rt, .. }
            | Self::Subu { rs, rt, .. }
            | Self::And { rs, rt, .. }
            | Self::Or { rs, rt, .. }
            | Self::Slt { rs, rt, .. }
            | Self::Beq { rs, rt, .. }
            | Self::Bne { rs, rt, .. } => [Some(rs), Some(rt)],
            Self::Sll { rt, .. } => [Some(rt), None],
            Self::Addiu { rs, .. } | Self::Lw { base: rs, .. } => [Some(rs), None],
            Self::Sw { rt, base, .. } => [Some(base), Some(rt)],
            Self::Nop | Self::J { .. } | Self::Halt => [None, None],
        }
    }

    /// Returns the destination register, excluding register zero and non-writing instructions.
    #[must_use]
    pub const fn destination_register(self) -> Option<u8> {
        let destination = match self {
            Self::Addu { rd, .. }
            | Self::Subu { rd, .. }
            | Self::And { rd, .. }
            | Self::Or { rd, .. }
            | Self::Slt { rd, .. }
            | Self::Sll { rd, .. } => Some(rd),
            Self::Addiu { rt, .. } | Self::Lw { rt, .. } => Some(rt),
            Self::Nop
            | Self::Sw { .. }
            | Self::Beq { .. }
            | Self::Bne { .. }
            | Self::J { .. }
            | Self::Halt => None,
        };
        match destination {
            Some(0) | None => None,
            other => other,
        }
    }

    /// Reports whether the result becomes available only after the memory stage.
    #[must_use]
    pub const fn is_load(self) -> bool {
        matches!(self, Self::Lw { .. })
    }

    /// Renders a stable human-readable representation used by traces and diagnostics.
    #[must_use]
    pub fn disassemble(self) -> String {
        match self {
            Self::Nop => "nop".to_owned(),
            Self::Addu { rd, rs, rt } => {
                format!("addu {}, {}, {}", register_name(rd), register_name(rs), register_name(rt))
            }
            Self::Subu { rd, rs, rt } => {
                format!("subu {}, {}, {}", register_name(rd), register_name(rs), register_name(rt))
            }
            Self::And { rd, rs, rt } => {
                format!("and {}, {}, {}", register_name(rd), register_name(rs), register_name(rt))
            }
            Self::Or { rd, rs, rt } => {
                format!("or {}, {}, {}", register_name(rd), register_name(rs), register_name(rt))
            }
            Self::Slt { rd, rs, rt } => {
                format!("slt {}, {}, {}", register_name(rd), register_name(rs), register_name(rt))
            }
            Self::Sll { rd, rt, shamt } => {
                format!("sll {}, {}, {shamt}", register_name(rd), register_name(rt))
            }
            Self::Addiu { rt, rs, immediate } => {
                format!("addiu {}, {}, {immediate}", register_name(rt), register_name(rs))
            }
            Self::Lw { rt, base, offset } => {
                format!("lw {}, {offset}({})", register_name(rt), register_name(base))
            }
            Self::Sw { rt, base, offset } => {
                format!("sw {}, {offset}({})", register_name(rt), register_name(base))
            }
            Self::Beq { rs, rt, offset } => {
                format!("beq {}, {}, {offset}", register_name(rs), register_name(rt))
            }
            Self::Bne { rs, rt, offset } => {
                format!("bne {}, {}, {offset}", register_name(rs), register_name(rt))
            }
            Self::J { target } => format!("j 0x{:08x}", target << 2),
            Self::Halt => "halt".to_owned(),
        }
    }
}

fn encode_r(rs: u8, rt: u8, rd: u8, shamt: u8, function: u8) -> u32 {
    u32::from(rs) << 21
        | u32::from(rt) << 16
        | u32::from(rd) << 11
        | u32::from(shamt) << 6
        | u32::from(function)
}

fn encode_i(opcode: u8, rs: u8, rt: u8, immediate: i16) -> u32 {
    u32::from(opcode) << 26
        | u32::from(rs) << 21
        | u32::from(rt) << 16
        | u32::from(immediate.cast_unsigned())
}
