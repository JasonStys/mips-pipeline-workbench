//! File: Applies deterministic property-style encode/decode checks across thousands of operands.
//!
//! Major tests: instruction round trips, zero-register destination semantics, and bad opcodes.
//! State: a deterministic xorshift seed; no external randomness or hidden fixtures.

use mips_workbench::Instruction;

#[test]
fn valid_instructions_round_trip_across_generated_operands()
-> Result<(), Box<dyn std::error::Error>> {
    let mut state = 0x5eed_cafe_dead_beef_u64;
    for _ in 0..10_000 {
        state = xorshift(state);
        let rd = ((state >> 3) & 31) as u8;
        let rs = ((state >> 11) & 31) as u8;
        let rt = ((state >> 19) & 31) as u8;
        let shamt = ((state >> 27) & 31) as u8;
        let bytes = state.to_le_bytes();
        let immediate = i16::from_le_bytes([bytes[0], bytes[1]]);
        let target = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) & 0x03ff_ffff;
        let instructions = [
            Instruction::Addu { rd, rs, rt },
            Instruction::Subu { rd, rs, rt },
            Instruction::And { rd, rs, rt },
            Instruction::Or { rd, rs, rt },
            Instruction::Slt { rd, rs, rt },
            Instruction::Sll { rd, rt, shamt },
            Instruction::Addiu { rt, rs, immediate },
            Instruction::Lw { rt, base: rs, offset: immediate },
            Instruction::Sw { rt, base: rs, offset: immediate },
            Instruction::Beq { rs, rt, offset: immediate },
            Instruction::Bne { rs, rt, offset: immediate },
            Instruction::J { target },
        ];
        for instruction in instructions {
            assert_eq!(Instruction::decode(instruction.encode())?, instruction);
        }
    }
    Ok(())
}

#[test]
fn register_zero_is_never_a_destination() {
    assert_eq!(Instruction::Addu { rd: 0, rs: 1, rt: 2 }.destination_register(), None);
    assert_eq!(Instruction::Addiu { rt: 0, rs: 1, immediate: 9 }.destination_register(), None);
}

#[test]
fn unsupported_opcode_is_rejected() {
    let word = 0x3e_u32 << 26;
    assert!(Instruction::decode(word).is_err());
}

const fn xorshift(mut value: u64) -> u64 {
    value ^= value << 13;
    value ^= value >> 7;
    value ^= value << 17;
    value
}
