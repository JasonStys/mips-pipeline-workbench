//! File: Models bounded set-associative caches with deterministic least-recently-used replacement.
//!
//! Major symbols: `CacheConfig`, `SetAssociativeCache`, `CacheStats`, and `access`.
//! State: fixed cache lines, logical clock, hit count, and miss count.

use std::error::Error;
use std::fmt::{Display, Formatter};

/// Construction parameters for a cache with fixed-size lines and associativity.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CacheConfig {
    pub sets: usize,
    pub ways: usize,
    pub line_bytes: u32,
}

/// Read-only cache outcome counters.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CacheStats {
    pub accesses: u64,
    pub hits: u64,
    pub misses: u64,
}

impl CacheStats {
    /// Returns a finite hit ratio, including `0.0` before the first access.
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn hit_ratio(self) -> f64 {
        if self.accesses == 0 { 0.0 } else { self.hits as f64 / self.accesses as f64 }
    }
}

/// Invalid configurations are rejected before allocating cache storage.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CacheError {
    ZeroSets,
    ZeroWays,
    InvalidLineSize,
}

impl Display for CacheError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ZeroSets => formatter.write_str("cache must contain at least one set"),
            Self::ZeroWays => formatter.write_str("cache must contain at least one way"),
            Self::InvalidLineSize => {
                formatter.write_str("cache line size must be a non-zero power of two")
            }
        }
    }
}

impl Error for CacheError {}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
struct CacheLine {
    tag: u64,
    last_used: u64,
    valid: bool,
}

/// A bounded set-associative cache; access is O(ways), constant for fixed associativity.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SetAssociativeCache {
    config: CacheConfig,
    lines: Vec<Vec<CacheLine>>,
    clock: u64,
    hits: u64,
    misses: u64,
}

impl SetAssociativeCache {
    /// Validates dimensions and creates an empty cache.
    ///
    /// # Errors
    /// Rejects zero sets/ways and line sizes that are not powers of two.
    pub fn new(config: CacheConfig) -> Result<Self, CacheError> {
        if config.sets == 0 {
            return Err(CacheError::ZeroSets);
        }
        if config.ways == 0 {
            return Err(CacheError::ZeroWays);
        }
        if !config.line_bytes.is_power_of_two() {
            return Err(CacheError::InvalidLineSize);
        }
        let lines = vec![vec![CacheLine::default(); config.ways]; config.sets];
        Ok(Self { config, lines, clock: 0, hits: 0, misses: 0 })
    }

    /// Records an address access and returns `true` on hit or `false` on miss.
    pub fn access(&mut self, address: u32) -> bool {
        self.clock = self.clock.saturating_add(1);
        let block = u64::from(address / self.config.line_bytes);
        let set_count = self.config.sets as u64;
        let set_index = usize::try_from(block % set_count).unwrap_or_default();
        let tag = block / set_count;
        let set = &mut self.lines[set_index];

        if let Some(line) = set.iter_mut().find(|line| line.valid && line.tag == tag) {
            line.last_used = self.clock;
            self.hits = self.hits.saturating_add(1);
            return true;
        }

        self.misses = self.misses.saturating_add(1);
        let victim_index = set
            .iter()
            .position(|line| !line.valid)
            .or_else(|| {
                set.iter()
                    .enumerate()
                    .min_by_key(|(_, line)| line.last_used)
                    .map(|(index, _)| index)
            })
            .unwrap_or(0);
        set[victim_index] = CacheLine { tag, last_used: self.clock, valid: true };
        false
    }

    /// Returns immutable metrics without exposing replacement metadata.
    #[must_use]
    pub const fn stats(&self) -> CacheStats {
        CacheStats { accesses: self.hits + self.misses, hits: self.hits, misses: self.misses }
    }

    /// Invalidates every line and clears counters, preserving the configured shape.
    pub fn reset(&mut self) {
        for set in &mut self.lines {
            set.fill(CacheLine::default());
        }
        self.clock = 0;
        self.hits = 0;
        self.misses = 0;
    }
}
