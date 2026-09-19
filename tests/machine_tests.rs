//! File: Verifies bounded reference execution, memory safety checks, and architectural invariants.
//!
//! Major tests: hazard demo results, Fibonacci result, alignment faults, limits, and immutable zero.
//! State: example programs loaded at compile time; no external or mutable shared data.

use mips_workbench::{ExecutionError, Machine, assemble};

#[test]
fn reference_machine_executes_hazard_demo() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble(include_str!("../examples/hazard-demo.asm"))?;
    let mut machine = Machine::from_program(&program);
    let summary = machine.run(100)?;
    assert_eq!(summary.retired, 11);
    assert_eq!(machine.register(12), 26);
    assert_eq!(machine.register(13), 21);
    assert_eq!(machine.memory_word(256), Some(13));
    assert_eq!(machine.register(0), 0);
    Ok(())
}

#[test]
fn computes_tenth_fibonacci_value() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble(include_str!("../examples/fibonacci.asm"))?;
    let mut machine = Machine::from_program(&program);
    machine.run(200)?;
    assert_eq!(machine.register(10), 55);
    assert_eq!(machine.memory_word(512), Some(55));
    Ok(())
}

#[test]
fn rejects_unaligned_loads() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble("li $t0, 3\nlw $t1, 0($t0)\nhalt\n")?;
    let mut machine = Machine::from_program(&program);
    let Err(error) = machine.run(10) else {
        return Err("unaligned load was accepted".into());
    };
    assert_eq!(error, ExecutionError::MisalignedAddress { address: 3, operation: "load" });
    Ok(())
}

#[test]
fn bounds_non_terminating_programs() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble("loop: j loop\n")?;
    let mut machine = Machine::from_program(&program);
    assert_eq!(machine.run(8), Err(ExecutionError::StepLimitExceeded { limit: 8 }));
    Ok(())
}
