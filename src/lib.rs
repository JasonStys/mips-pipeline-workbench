//! File: Exposes the assembler, ISA, reference machine, cache model, and five-stage pipeline.
//!
//! Major modules: `assembler`, `cache`, `isa`, `machine`, and `pipeline`.
//! State: this facade owns no mutable state; exact declarations are indexed in `docs/code-index.md`.

pub mod assembler;
pub mod cache;
pub mod isa;
pub mod machine;
pub mod pipeline;

pub use assembler::{AssemblerError, Program, assemble};
pub use cache::{CacheConfig, CacheError, CacheStats, SetAssociativeCache};
pub use isa::{DecodeError, Instruction, REGISTER_NAMES, register_name};
pub use machine::{ExecutionError, Machine, RunSummary};
pub use pipeline::{PipelineCycle, PipelineError, PipelineResult, PipelineSimulator};
