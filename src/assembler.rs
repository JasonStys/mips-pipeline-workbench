//! File: Implements a deterministic two-pass assembler with labels and precise diagnostics.
//!
//! Major symbols: `Program`, `AssemblerError`, `assemble`, and parsing helpers.
//! State: pass-local symbol tables and emitted words; exact declaration lines are indexed separately.

use crate::isa::Instruction;
use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{Display, Formatter};

/// A fully assembled program plus source text retained for trace diagnostics.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Program {
    pub words: Vec<u32>,
    pub source_lines: Vec<usize>,
    pub symbols: BTreeMap<String, u32>,
}

/// A source-aware assembly failure.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssemblerError {
    pub line: usize,
    pub message: String,
}

impl Display for AssemblerError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "line {}: {}", self.line, self.message)
    }
}

impl Error for AssemblerError {}

/// Assembles source in two linear passes: symbol discovery followed by encoding.
///
/// # Errors
/// Returns a line-numbered error for duplicate labels, malformed operands, overflows, or unknown
/// instructions. Program size is bounded to the 32-bit address space.
pub fn assemble(source: &str) -> Result<Program, AssemblerError> {
    let mut symbols = BTreeMap::new();
    let mut address = 0_u32;

    for (index, raw_line) in source.lines().enumerate() {
        let line_number = index + 1;
        let (label, statement) = split_label(strip_comment(raw_line), line_number)?;
        if let Some(label) = label
            && symbols.insert(label.clone(), address).is_some()
        {
            return Err(error(line_number, format!("duplicate label `{label}`")));
        }
        if !statement.is_empty() {
            address = address
                .checked_add(4)
                .ok_or_else(|| error(line_number, "program exceeds 32-bit address space"))?;
        }
    }

    let mut words = Vec::new();
    let mut source_lines = Vec::new();
    address = 0;
    for (index, raw_line) in source.lines().enumerate() {
        let line_number = index + 1;
        let (_, statement) = split_label(strip_comment(raw_line), line_number)?;
        if statement.is_empty() {
            continue;
        }
        let word = assemble_statement(statement, address, &symbols, line_number)?;
        words.push(word);
        source_lines.push(line_number);
        address = address.saturating_add(4);
    }

    Ok(Program { words, source_lines, symbols })
}

fn strip_comment(line: &str) -> &str {
    line.split('#').next().unwrap_or_default().trim()
}

fn split_label(line: &str, line_number: usize) -> Result<(Option<String>, &str), AssemblerError> {
    let Some((candidate, remainder)) = line.split_once(':') else {
        return Ok((None, line));
    };
    if remainder.contains(':') {
        return Err(error(line_number, "only one label is allowed per line"));
    }
    let label = candidate.trim();
    if !is_identifier(label) {
        return Err(error(line_number, format!("invalid label `{label}`")));
    }
    Ok((Some(label.to_owned()), remainder.trim()))
}

fn is_identifier(value: &str) -> bool {
    let mut chars = value.chars();
    matches!(chars.next(), Some(first) if first == '_' || first.is_ascii_alphabetic())
        && chars.all(|character| character == '_' || character.is_ascii_alphanumeric())
}

#[allow(clippy::too_many_lines)]
fn assemble_statement(
    statement: &str,
    address: u32,
    symbols: &BTreeMap<String, u32>,
    line: usize,
) -> Result<u32, AssemblerError> {
    let normalized = statement.replace([',', '(', ')'], " ");
    let tokens: Vec<&str> = normalized.split_whitespace().collect();
    let Some(mnemonic) = tokens.first().map(|value| value.to_ascii_lowercase()) else {
        return Err(error(line, "missing instruction"));
    };
    let operands = &tokens[1..];

    let instruction = match mnemonic.as_str() {
        "nop" => {
            expect_count(operands, 0, line)?;
            Instruction::Nop
        }
        "halt" => {
            expect_count(operands, 0, line)?;
            Instruction::Halt
        }
        "addu" | "subu" | "and" | "or" | "slt" => {
            expect_count(operands, 3, line)?;
            let rd = parse_register(operands[0], line)?;
            let rs = parse_register(operands[1], line)?;
            let rt = parse_register(operands[2], line)?;
            match mnemonic.as_str() {
                "addu" => Instruction::Addu { rd, rs, rt },
                "subu" => Instruction::Subu { rd, rs, rt },
                "and" => Instruction::And { rd, rs, rt },
                "or" => Instruction::Or { rd, rs, rt },
                _ => Instruction::Slt { rd, rs, rt },
            }
        }
        "sll" => {
            expect_count(operands, 3, line)?;
            let rd = parse_register(operands[0], line)?;
            let rt = parse_register(operands[1], line)?;
            let shamt = parse_u5(operands[2], line)?;
            Instruction::Sll { rd, rt, shamt }
        }
        "addiu" => {
            expect_count(operands, 3, line)?;
            Instruction::Addiu {
                rt: parse_register(operands[0], line)?,
                rs: parse_register(operands[1], line)?,
                immediate: parse_i16(operands[2], line)?,
            }
        }
        "li" => {
            expect_count(operands, 2, line)?;
            Instruction::Addiu {
                rt: parse_register(operands[0], line)?,
                rs: 0,
                immediate: parse_i16(operands[1], line)?,
            }
        }
        "move" => {
            expect_count(operands, 2, line)?;
            Instruction::Addu {
                rd: parse_register(operands[0], line)?,
                rs: parse_register(operands[1], line)?,
                rt: 0,
            }
        }
        "lw" | "sw" => {
            expect_count(operands, 3, line)?;
            let rt = parse_register(operands[0], line)?;
            let offset = parse_i16(operands[1], line)?;
            let base = parse_register(operands[2], line)?;
            if mnemonic == "lw" {
                Instruction::Lw { rt, base, offset }
            } else {
                Instruction::Sw { rt, base, offset }
            }
        }
        "beq" | "bne" => {
            expect_count(operands, 3, line)?;
            let rs = parse_register(operands[0], line)?;
            let rt = parse_register(operands[1], line)?;
            let target = resolve_address(operands[2], symbols, line)?;
            let delta = i64::from(target) - (i64::from(address) + 4);
            if delta % 4 != 0 {
                return Err(error(line, "branch target must be word-aligned"));
            }
            let offset = i16::try_from(delta / 4)
                .map_err(|_| error(line, "branch target is outside the signed 16-bit range"))?;
            if mnemonic == "beq" {
                Instruction::Beq { rs, rt, offset }
            } else {
                Instruction::Bne { rs, rt, offset }
            }
        }
        "j" => {
            expect_count(operands, 1, line)?;
            let target = resolve_address(operands[0], symbols, line)?;
            if target % 4 != 0 {
                return Err(error(line, "jump target must be word-aligned"));
            }
            Instruction::J { target: target >> 2 }
        }
        ".word" => {
            expect_count(operands, 1, line)?;
            return parse_u32(operands[0], line);
        }
        _ => return Err(error(line, format!("unknown instruction `{mnemonic}`"))),
    };

    Ok(instruction.encode())
}

fn expect_count(operands: &[&str], expected: usize, line: usize) -> Result<(), AssemblerError> {
    if operands.len() == expected {
        Ok(())
    } else {
        Err(error(line, format!("expected {expected} operand(s), received {}", operands.len())))
    }
}

fn parse_register(token: &str, line: usize) -> Result<u8, AssemblerError> {
    let normalized = token.trim_start_matches('$').to_ascii_lowercase();
    let named = match normalized.as_str() {
        "zero" => Some(0),
        "at" => Some(1),
        "v0" => Some(2),
        "v1" => Some(3),
        "a0" => Some(4),
        "a1" => Some(5),
        "a2" => Some(6),
        "a3" => Some(7),
        "t0" => Some(8),
        "t1" => Some(9),
        "t2" => Some(10),
        "t3" => Some(11),
        "t4" => Some(12),
        "t5" => Some(13),
        "t6" => Some(14),
        "t7" => Some(15),
        "s0" => Some(16),
        "s1" => Some(17),
        "s2" => Some(18),
        "s3" => Some(19),
        "s4" => Some(20),
        "s5" => Some(21),
        "s6" => Some(22),
        "s7" => Some(23),
        "t8" | "t9" => normalized[1..].parse::<u8>().ok().map(|value| value + 16),
        "k0" | "k1" => normalized[1..].parse::<u8>().ok().map(|value| value + 26),
        "gp" => Some(28),
        "sp" => Some(29),
        "fp" | "s8" => Some(30),
        "ra" => Some(31),
        _ => normalized.parse::<u8>().ok().filter(|value| *value < 32),
    };
    named.ok_or_else(|| error(line, format!("invalid register `{token}`")))
}

fn parse_i16(token: &str, line: usize) -> Result<i16, AssemblerError> {
    let value = parse_integer(token, line)?;
    i16::try_from(value).map_err(|_| error(line, format!("`{token}` is outside the i16 range")))
}

fn parse_u5(token: &str, line: usize) -> Result<u8, AssemblerError> {
    let value = parse_integer(token, line)?;
    u8::try_from(value)
        .ok()
        .filter(|value| *value < 32)
        .ok_or_else(|| error(line, format!("shift amount `{token}` must be between 0 and 31")))
}

fn parse_u32(token: &str, line: usize) -> Result<u32, AssemblerError> {
    let value = parse_integer(token, line)?;
    u32::try_from(value).map_err(|_| error(line, format!("`{token}` is outside the u32 range")))
}

fn parse_integer(token: &str, line: usize) -> Result<i64, AssemblerError> {
    let parsed = match (token.strip_prefix("0x"), token.strip_prefix("-0x")) {
        (Some(hex), _) => i64::from_str_radix(hex, 16),
        (_, Some(hex)) => i64::from_str_radix(hex, 16).map(|value| -value),
        (None, None) => token.parse::<i64>(),
    };
    parsed.map_err(|_| error(line, format!("invalid integer `{token}`")))
}

fn resolve_address(
    token: &str,
    symbols: &BTreeMap<String, u32>,
    line: usize,
) -> Result<u32, AssemblerError> {
    symbols.get(token).copied().map_or_else(|| parse_u32(token, line), Ok)
}

fn error(line: usize, message: impl Into<String>) -> AssemblerError {
    AssemblerError { line, message: message.into() }
}
