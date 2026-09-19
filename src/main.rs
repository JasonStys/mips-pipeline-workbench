//! File: Provides bounded CLI commands for assembly, reference execution, pipeline traces, and benchmarks.
//!
//! Major symbols: `main`, `run_cli`, command handlers, and argument parsers.
//! State: command arguments and transient benchmark counters; declarations are indexed in the docs.

use mips_workbench::{Machine, PipelineSimulator, assemble, register_name};
use std::env;
use std::error::Error;
use std::fs;
use std::path::Path;
use std::time::Instant;

const DEFAULT_LIMIT: u64 = 100_000;
const BENCHMARK_ITERATIONS: u32 = 200;

fn main() {
    if let Err(error) = run_cli() {
        eprintln!("error: {error}");
        std::process::exit(1);
    }
}

fn run_cli() -> Result<(), Box<dyn Error>> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    match arguments.first().map(String::as_str) {
        None | Some("help" | "--help" | "-h") => {
            print_help();
            Ok(())
        }
        Some("assemble") => command_assemble(&arguments[1..]),
        Some("run") => command_run(&arguments[1..]),
        Some("pipeline") => command_pipeline(&arguments[1..]),
        Some("benchmark") => command_benchmark(&arguments[1..]),
        Some(command) => Err(format!("unknown command `{command}`; use `help` for usage").into()),
    }
}

fn command_assemble(arguments: &[String]) -> Result<(), Box<dyn Error>> {
    if arguments.len() != 2 {
        return Err("usage: mips-workbench assemble <input.asm> <output.bin>".into());
    }
    let program = load_program(&arguments[0])?;
    let mut bytes = Vec::with_capacity(program.words.len().saturating_mul(4));
    for word in &program.words {
        bytes.extend_from_slice(&word.to_be_bytes());
    }
    fs::write(&arguments[1], bytes)?;
    println!("assembled {} instruction word(s) into {}", program.words.len(), arguments[1]);
    Ok(())
}

fn command_run(arguments: &[String]) -> Result<(), Box<dyn Error>> {
    if !(1..=2).contains(&arguments.len()) {
        return Err("usage: mips-workbench run <input.asm> [max-steps]".into());
    }
    let limit = parse_limit(arguments.get(1), DEFAULT_LIMIT)?;
    let program = load_program(&arguments[0])?;
    let mut machine = Machine::from_program(&program);
    let summary = machine.run(limit)?;
    println!("retired={} final_pc=0x{:08x}", summary.retired, summary.final_pc);
    print_nonzero_registers(machine.registers());
    Ok(())
}

fn command_pipeline(arguments: &[String]) -> Result<(), Box<dyn Error>> {
    if !(1..=3).contains(&arguments.len()) {
        return Err("usage: mips-workbench pipeline <input.asm> [trace.json] [max-cycles]".into());
    }
    let limit = parse_limit(arguments.get(2), DEFAULT_LIMIT)?;
    let program = load_program(&arguments[0])?;
    let simulator = PipelineSimulator { max_cycles: limit, ..PipelineSimulator::default() };
    let result = simulator.run(&program)?;
    println!(
        "cycles={} retired={} cpi={:.3} stalls={} flushes={}",
        result.cycles.len(),
        result.retired,
        result.cpi(),
        result.stalls,
        result.flushes
    );
    print_nonzero_registers(&result.registers);
    if let Some(output) = arguments.get(1) {
        fs::write(output, format!("{}\n", result.to_json()))?;
        println!("wrote trace to {output}");
    }
    Ok(())
}

fn command_benchmark(arguments: &[String]) -> Result<(), Box<dyn Error>> {
    if arguments.len() != 2 {
        return Err("usage: mips-workbench benchmark <input.asm> <report.json>".into());
    }
    let program = load_program(&arguments[0])?;
    let started = Instant::now();
    let mut final_result = None;
    for _ in 0..BENCHMARK_ITERATIONS {
        final_result = Some(PipelineSimulator::default().run(&program)?);
    }
    let elapsed = started.elapsed();
    let result = final_result.ok_or("benchmark iteration count must be positive")?;
    let per_run_micros = elapsed.as_micros() / u128::from(BENCHMARK_ITERATIONS);
    let report = format!(
        concat!(
            "{{\n  \"schemaVersion\": 1,\n  \"program\": \"{}\",\n",
            "  \"iterations\": {},\n  \"meanMicroseconds\": {},\n",
            "  \"simulatedCycles\": {},\n  \"retired\": {},\n  \"cpi\": {:.4}\n}}\n"
        ),
        json_escape(&arguments[0]),
        BENCHMARK_ITERATIONS,
        per_run_micros,
        result.cycles.len(),
        result.retired,
        result.cpi()
    );
    fs::write(&arguments[1], report)?;
    println!("benchmark complete: mean={per_run_micros}us over {BENCHMARK_ITERATIONS} runs");
    Ok(())
}

fn load_program(path: impl AsRef<Path>) -> Result<mips_workbench::Program, Box<dyn Error>> {
    let source = fs::read_to_string(path)?;
    Ok(assemble(&source)?)
}

fn parse_limit(value: Option<&String>, default: u64) -> Result<u64, Box<dyn Error>> {
    value.map_or(Ok(default), |text| {
        let parsed = text.parse::<u64>()?;
        if parsed == 0 {
            Err("execution limit must be greater than zero".into())
        } else {
            Ok(parsed)
        }
    })
}

fn print_nonzero_registers(registers: &[u32; 32]) {
    let mut printed = false;
    for (index, value) in registers.iter().enumerate().filter(|(_, value)| **value != 0) {
        let register = u8::try_from(index).unwrap_or_default();
        println!("{}=0x{value:08x} ({value})", register_name(register));
        printed = true;
    }
    if !printed {
        println!("registers: all zero");
    }
}

fn json_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn print_help() {
    println!(
        "MIPS Pipeline Workbench\n\n\
         Commands:\n\
           assemble <input.asm> <output.bin>\n\
           run <input.asm> [max-steps]\n\
           pipeline <input.asm> [trace.json] [max-cycles]\n\
           benchmark <input.asm> <report.json>\n\n\
         All execution commands are bounded. See docs/isa-profile.md for the supported subset."
    );
}
