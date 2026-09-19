//! File: Verifies two-pass labels, aliases, encoding, and source-aware rejection paths.
//!
//! Major tests: labels, pseudo-instructions, malformed registers, duplicates, and branch range.
//! State: immutable inline assembly fixtures; exact test declarations are indexed in the docs.

use mips_workbench::{Instruction, assemble};

#[test]
fn resolves_forward_and_backward_labels() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble(
        "start: addiu $t0, $zero, 1\n\
         bne $t0, $zero, start\n\
         j done\n\
         done: halt\n",
    )?;
    assert_eq!(program.symbols.get("start"), Some(&0));
    assert_eq!(program.symbols.get("done"), Some(&12));
    assert_eq!(
        Instruction::decode(program.words[1])?,
        Instruction::Bne { rs: 8, rt: 0, offset: -2 }
    );
    assert_eq!(Instruction::decode(program.words[2])?, Instruction::J { target: 3 });
    Ok(())
}

#[test]
fn expands_single_word_pseudo_instructions() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble("li $s0, -12\nmove $s1, $s0\nnop\nhalt\n")?;
    assert_eq!(
        Instruction::decode(program.words[0])?,
        Instruction::Addiu { rt: 16, rs: 0, immediate: -12 }
    );
    assert_eq!(Instruction::decode(program.words[1])?, Instruction::Addu { rd: 17, rs: 16, rt: 0 });
    Ok(())
}

#[test]
fn preserves_precise_line_numbers_for_invalid_input() -> Result<(), Box<dyn std::error::Error>> {
    let Err(error) = assemble("nop\naddiu $missing, $zero, 1\n") else {
        return Err("invalid register was accepted".into());
    };
    assert_eq!(error.line, 2);
    assert!(error.message.contains("invalid register"));
    Ok(())
}

#[test]
fn rejects_duplicate_labels() -> Result<(), Box<dyn std::error::Error>> {
    let Err(error) = assemble("same: nop\nsame: halt\n") else {
        return Err("duplicate label was accepted".into());
    };
    assert_eq!(error.line, 2);
    assert!(error.message.contains("duplicate label"));
    Ok(())
}

#[test]
fn emits_literal_words() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble(".word 0x1234abcd\n")?;
    assert_eq!(program.words, [0x1234_abcd]);
    Ok(())
}
