//! File: Verifies cache indexing, least-recently-used replacement, counters, and validation.
//!
//! Major tests: direct mapping, associativity, reset, invalid shape, and finite empty metrics.
//! State: small bounded cache fixtures with deterministic address sequences.

use mips_workbench::{CacheConfig, CacheError, SetAssociativeCache};

#[test]
fn direct_mapped_cache_tracks_conflict_misses() -> Result<(), Box<dyn std::error::Error>> {
    let mut cache = SetAssociativeCache::new(CacheConfig { sets: 2, ways: 1, line_bytes: 16 })?;
    assert!(!cache.access(0));
    assert!(cache.access(4));
    assert!(!cache.access(32));
    assert!(!cache.access(0));
    assert_eq!(cache.stats().hits, 1);
    assert_eq!(cache.stats().misses, 3);
    Ok(())
}

#[test]
fn two_way_cache_replaces_least_recently_used_line() -> Result<(), Box<dyn std::error::Error>> {
    let mut cache = SetAssociativeCache::new(CacheConfig { sets: 1, ways: 2, line_bytes: 4 })?;
    assert!(!cache.access(0));
    assert!(!cache.access(4));
    assert!(cache.access(0));
    assert!(!cache.access(8));
    assert!(cache.access(0));
    assert!(!cache.access(4));
    Ok(())
}

#[test]
fn reset_clears_lines_and_statistics() -> Result<(), Box<dyn std::error::Error>> {
    let mut cache = SetAssociativeCache::new(CacheConfig { sets: 4, ways: 2, line_bytes: 16 })?;
    cache.access(0);
    cache.access(0);
    cache.reset();
    assert_eq!(cache.stats().accesses, 0);
    assert!(cache.stats().hit_ratio().abs() < f64::EPSILON);
    assert!(!cache.access(0));
    Ok(())
}

#[test]
fn rejects_invalid_cache_dimensions() {
    assert_eq!(
        SetAssociativeCache::new(CacheConfig { sets: 0, ways: 1, line_bytes: 4 }),
        Err(CacheError::ZeroSets)
    );
    assert_eq!(
        SetAssociativeCache::new(CacheConfig { sets: 1, ways: 0, line_bytes: 4 }),
        Err(CacheError::ZeroWays)
    );
    assert_eq!(
        SetAssociativeCache::new(CacheConfig { sets: 1, ways: 1, line_bytes: 3 }),
        Err(CacheError::InvalidLineSize)
    );
}
