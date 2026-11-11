//! File: Exposes bounded machine-readable execution/cache commands for the actual native studio.
//!
//! Major symbols: `command`, `source_file`, and `bounded_number`; variables are fixed argument budgets.
//! These commands emit JSON only to stdout; they do not accept binary/plugin/network/device commands.
//! Physical symbol locations are in `docs/code-index.md`.

use mips_workbench::CacheConfig;
use mips_workbench::studio::{ExecutionConfig, MAX_SOURCE_BYTES, analyze, cache_report};
use std::error::Error;
use std::fs::File;
use std::io::Read;

/// Run only the fixed studio protocol; malformed commands never select another executable.
pub fn command(arguments: &[String]) -> Result<(), Box<dyn Error>> {
    match arguments.first().map(String::as_str) {
        Some("version") if arguments.len() == 1 => {
            let source = option_env!("PORTFOLIO_SOURCE_SHA").unwrap_or("development");
            if source != "development" && (source.len() != 40 || !source.bytes().all(|value| value.is_ascii_digit() || (b'a'..=b'f').contains(&value))) {
                return Err("Invalid compiled source identity".into());
            }
            println!("{{\"schemaVersion\":1,\"name\":\"mips-pipeline-workbench\",\"version\":\"{}\",\"sourceCommit\":\"{source}\"}}", env!("CARGO_PKG_VERSION"));
        }
        Some("execute") if arguments.len() == 4 => {
            let source = source_file(&arguments[1])?;
            let config = ExecutionConfig {
                max_cycles: bounded_number(&arguments[2], 10_000)?,
                retained_cycles: usize::try_from(bounded_number(&arguments[3], 10_000)?)?,
            };
            match analyze(&source, config) {
                Ok(report) => println!("{}", report.to_json()),
                Err(error) => {
                    println!("{}", error.to_json());
                    return Err("Studio source/execution diagnostic; no verified report produced".into());
                }
            }
        }
        Some("cache") if arguments.len() == 5 => {
            let source = source_file(&arguments[4])?;
            let config = CacheConfig {
                sets: usize::try_from(bounded_number(&arguments[1], 64)?)?,
                ways: usize::try_from(bounded_number(&arguments[2], 8)?)?,
                line_bytes: u32::try_from(bounded_number(&arguments[3], 256)?)?,
            };
            let mut addresses = Vec::new();
            for word in source.split(|character: char| character.is_whitespace() || character == ',') {
                if word.is_empty() { continue; }
                if addresses.len() >= 10_000 { return Err("Cache experiment exceeds 10000 addresses".into()); }
                let value = word.strip_prefix("0x").map_or_else(|| word.parse::<u32>(), |value| u32::from_str_radix(value, 16))?;
                addresses.push(value);
            }
            match cache_report(config, &addresses) {
                Ok(report) => println!("{report}"),
                Err(error) => {
                    println!("{}", error.to_json());
                    return Err("Studio cache diagnostic; no completed experiment produced".into());
                }
            }
        }
        _ => return Err("usage: studio version | execute <source.asm> <max-cycles> <retained-cycles> | cache <sets> <ways> <line-bytes> <address-file>".into()),
    }
    Ok(())
}

/// Read the actual open file with a fixed byte budget and strict UTF-8; no prior path metadata is trusted.
fn source_file(filename: &str) -> Result<String, Box<dyn Error>> {
    let mut raw = Vec::new();
    File::open(filename)?.take(u64::try_from(MAX_SOURCE_BYTES)? + 1).read_to_end(&mut raw)?;
    if raw.len() > MAX_SOURCE_BYTES {
        return Err("Studio input exceeds 128 KiB".into());
    }
    Ok(String::from_utf8(raw)?)
}

/// Decimal settings must fit the fixed contract; zero is interpreted by the specific model validator.
fn bounded_number(value: &str, maximum: u64) -> Result<u64, Box<dyn Error>> {
    let parsed = value.parse::<u64>()?;
    if parsed > maximum {
        return Err("Studio setting exceeds its fixed budget".into());
    }
    Ok(parsed)
}
