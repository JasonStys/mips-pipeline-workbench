//! File: Independently verify real native-studio architecture, physical diagnostics and LRU evidence.
//!
//! Major tests: exact memory/register values, Halt PC, retained-trace invariance, malformed source and cache order.
//! State: synthetic assembly/address fixtures only; physical locations are in `docs/code-index.md`.

use mips_workbench::{
    CacheConfig,
    studio::{ExecutionConfig, analyze, cache_report},
};

#[test]
fn native_analysis_preserves_exact_independent_memory_and_final_state()
-> Result<(), Box<dyn std::error::Error>> {
    let source =
        "li $t0, 64\nli $t1, 5\nsw $t1, 0($t0)\nlw $t2, 0($t0)\naddu $t3, $t2, $t1\nhalt\n";
    for retained_cycles in [0, 1, 100] {
        let result = analyze(source, ExecutionConfig { max_cycles: 100, retained_cycles })?;
        assert!(result.equivalent());
        assert_eq!(result.reference_registers[8..12], [64, 5, 5, 10]);
        assert_eq!(result.reference_memory.get(&64), Some(&5));
        assert_eq!(result.reference_pc, 24);
        assert_eq!(result.reference_retired, 6);
        assert_eq!(result.pipeline.stalls, 1);
        assert_eq!(result.pipeline.total_cycles, 11);
        assert_eq!(result.pipeline.cycles.len(), retained_cycles.min(11));
    }
    Ok(())
}

#[test]
fn a_self_modifying_disagreement_cannot_be_called_verified()
-> Result<(), Box<dyn std::error::Error>> {
    let source = "li $t0, 0\nsw $t0, 12($zero)\nnop\nli $t1, 7\nhalt\n";
    let result = analyze(source, ExecutionConfig { max_cycles: 100, retained_cycles: 100 })?;
    assert_eq!(result.reference_registers[9], 0);
    assert_eq!(result.pipeline.registers[9], 7);
    assert!(!result.equivalent());
    assert!(result.to_json().contains("\"status\":\"mismatch\""));
    Ok(())
}

#[test]
fn physical_source_lines_and_resource_faults_remain_diagnostics()
-> Result<(), Box<dyn std::error::Error>> {
    let config = ExecutionConfig { max_cycles: 100, retained_cycles: 10 };
    let error = analyze("# comment\n\nbogus $t0\nhalt\n", config)
        .err()
        .ok_or("Expected physical assembly diagnostic")?;
    assert_eq!(error.phase, "assembly");
    assert_eq!(error.line, Some(3));
    let error = analyze("li $t0, 1\nlw $t1, 1($zero)\nhalt\n", config)
        .err()
        .ok_or("Expected physical reference diagnostic")?;
    assert_eq!(error.phase, "reference");
    assert_eq!(error.line, Some(2));
    assert!(analyze("spin: j spin\n", config).is_err());
    assert!(analyze("halt\n", ExecutionConfig { max_cycles: 10_001, retained_cycles: 1 }).is_err());
    assert!(analyze("halt\n", ExecutionConfig { max_cycles: 0, retained_cycles: 1 }).is_err());
    assert!(
        analyze("halt\n", ExecutionConfig { max_cycles: 100, retained_cycles: 10_001 }).is_err()
    );
    assert!(analyze("", config).is_err());
    assert_eq!(
        analyze(&"h".repeat(128 * 1024 + 1), config)
            .err()
            .ok_or("Expected source byte budget")?
            .phase,
        "input"
    );
    Ok(())
}

#[test]
fn independently_counted_lru_and_empty_evidence_are_distinct()
-> Result<(), Box<dyn std::error::Error>> {
    let config = CacheConfig { sets: 2, ways: 2, line_bytes: 4 };
    let result = cache_report(config, &[0, 4, 8, 0, 16, 8, 0])?;
    assert!(result.contains("\"accesses\":7,\"hits\":1,\"misses\":6"));
    assert!(
        cache_report(config, &[])?
            .contains("\"accesses\":0,\"hits\":0,\"misses\":0,\"hitRatio\":0")
    );
    for invalid in [
        CacheConfig { sets: 65, ..config },
        CacheConfig { ways: 0, ..config },
        CacheConfig { line_bytes: 3, ..config },
    ] {
        assert!(cache_report(invalid, &[0]).is_err());
    }
    assert!(cache_report(config, &vec![0; 10_001]).is_err());
    Ok(())
}
