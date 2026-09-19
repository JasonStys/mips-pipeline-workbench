//! File: Differentially verifies the pipelined implementation and exact hazard accounting.
//!
//! Major tests: reference parity, forwarding, load interlock, branch flush, trace JSON, and limits.
//! State: deterministic examples and generated straight-line programs only.

use mips_workbench::{Machine, PipelineError, PipelineSimulator, assemble};

#[test]
fn pipeline_matches_reference_for_all_examples() -> Result<(), Box<dyn std::error::Error>> {
    for source in [
        include_str!("../examples/hazard-demo.asm"),
        include_str!("../examples/fibonacci.asm"),
        include_str!("../examples/cache-walk.asm"),
    ] {
        let program = assemble(source)?;
        let mut reference = Machine::from_program(&program);
        reference.run(1_000)?;
        let pipelined = PipelineSimulator::default().run(&program)?;
        assert_eq!(&pipelined.registers, reference.registers());
        assert_eq!(&pipelined.memory, reference.memory());
    }
    Ok(())
}

#[test]
fn inserts_one_load_use_stall_and_records_control_flushes() -> Result<(), Box<dyn std::error::Error>>
{
    let program = assemble(include_str!("../examples/hazard-demo.asm"))?;
    let result = PipelineSimulator::default().run(&program)?;
    assert_eq!(result.stalls, 1);
    assert!(result.flushes >= 2);
    assert!(
        result.cycles.iter().any(|cycle| {
            cycle.event.as_deref().is_some_and(|event| event.contains("load-use"))
        })
    );
    assert!(result.cycles.iter().any(|cycle| {
        cycle.event.as_deref().is_some_and(|event| event.contains("control hazard"))
    }));
    Ok(())
}

#[test]
fn forwarding_avoids_unnecessary_arithmetic_stalls() -> Result<(), Box<dyn std::error::Error>> {
    let program =
        assemble("li $t0, 2\naddiu $t1, $t0, 3\naddu $t2, $t1, $t0\nsubu $t3, $t2, $t0\nhalt\n")?;
    let result = PipelineSimulator::default().run(&program)?;
    assert_eq!(result.stalls, 0);
    assert_eq!(result.registers[11], 5);
    Ok(())
}

#[test]
fn trace_is_valid_json_shape_without_unbounded_content() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble("li $t0, 7\nhalt\n")?;
    let simulator = PipelineSimulator { max_trace_cycles: 3, ..PipelineSimulator::default() };
    let result = simulator.run(&program)?;
    let json = result.to_json();
    assert!(json.starts_with("{\"schemaVersion\":1"));
    assert!(json.contains("\"registers\":[0,0,0,0,0,0,0,0,7"));
    assert!(result.cycles.len() <= 3);
    Ok(())
}

#[test]
fn bounds_pipeline_cycles() -> Result<(), Box<dyn std::error::Error>> {
    let program = assemble("loop: j loop\n")?;
    let simulator = PipelineSimulator { max_cycles: 4, ..PipelineSimulator::default() };
    assert_eq!(simulator.run(&program), Err(PipelineError::CycleLimitExceeded { limit: 4 }));
    Ok(())
}

#[test]
fn generated_straight_line_programs_match_reference() -> Result<(), Box<dyn std::error::Error>> {
    for seed in 1..=128_i16 {
        let source = format!(
            "li $t0, {seed}\naddiu $t1, $t0, 7\naddu $t2, $t0, $t1\nsubu $t3, $t2, $t0\nand $t4, $t2, $t3\nor $t5, $t4, $t0\nhalt\n"
        );
        let program = assemble(&source)?;
        let mut reference = Machine::from_program(&program);
        reference.run(100)?;
        let pipelined = PipelineSimulator::default().run(&program)?;
        assert_eq!(pipelined.registers, *reference.registers());
    }
    Ok(())
}
