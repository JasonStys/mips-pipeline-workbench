"""File: Verify real native-studio JSON, physical diagnostics and independently expected results.

Major symbols: NativeCliTests and invoke. State: inert TemporaryDirectory inputs and
the trusted repository-built engine only. Exact declarations: docs/code-index.md.
Created by Jason Stys; no source fallback, hardware, uploaded executable or mock engine.
"""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = Path(
    os.environ.get(
        "MIPS_ENGINE",
        ROOT / "target/debug" / ("mips-workbench.exe" if os.name == "nt" else "mips-workbench"),
    )
)
SOURCE = "li $t0, 64\nli $t1, 5\nsw $t1, 0($t0)\nlw $t2, 0($t0)\naddu $t3, $t2, $t1\nhalt\n"


def invoke(*arguments):
    """Run only the actual fixed engine with a deadline; argv never reaches a shell."""
    return subprocess.run(
        [str(ENGINE), "studio", *map(str, arguments)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=5,
        check=False,
    )


class NativeCliTests(unittest.TestCase):
    """Independent values distinguish process success from model agreement."""

    def setUp(self):
        """A missing native build is a failing prerequisite, never a skipped/reimplemented test."""
        self.assertTrue(ENGINE.is_file(), "Build the actual Rust engine before these tests")
        self.folder = tempfile.TemporaryDirectory(prefix="mips-engine-contract-")
        self.addCleanup(self.folder.cleanup)
        self.source = Path(self.folder.name) / "source.asm"

    def test_actual_version_is_current_product(self):
        result = invoke("version")
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value["name"], "mips-pipeline-workbench")
        self.assertEqual(value["version"], "1.1.0")

    def test_exact_architecture_listing_and_retention_invariance(self):
        self.source.write_text(SOURCE, encoding="utf-8")
        for retained in (0, 1, 100):
            with self.subTest(retained=retained):
                result = invoke("execute", self.source, 100, retained)
                self.assertEqual(result.returncode, 0, result.stderr)
                value = json.loads(result.stdout)
                self.assertEqual((value["status"], value["equivalent"]), ("verified", True))
                self.assertEqual(value["reference"]["registers"][8:12], [64, 5, 5, 10])
                self.assertEqual(value["reference"]["finalPc"], 24)
                self.assertEqual(value["reference"]["retired"], 6)
                self.assertIn({"address": 64, "word": 5}, value["reference"]["memory"])
                self.assertEqual(value["reference"]["memory"], value["pipelineMemory"])
                self.assertEqual(value["trace"]["summary"]["cycles"], 11)
                self.assertEqual(value["trace"]["summary"]["stalls"], 1)
                self.assertEqual(len(value["trace"]["cycles"]), min(retained, 11))
                # Independent MIPS addiu encoding: opcode9, rs0, rt8, immediate64.
                self.assertEqual(value["listing"][0], {"address": 0, "word": 0x24080040, "line": 1})

    def test_mismatch_is_not_a_verified_exit_code(self):
        self.source.write_text(
            "li $t0, 0\nsw $t0, 12($zero)\nnop\nli $t1, 7\nhalt\n", encoding="utf-8"
        )
        result = invoke("execute", self.source, 100, 100)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual((value["status"], value["equivalent"]), ("mismatch", False))
        self.assertEqual(value["reference"]["registers"][9], 0)
        self.assertEqual(value["trace"]["registers"][9], 7)

    def test_real_assembly_and_runtime_errors_have_physical_lines(self):
        for source, phase, line in [
            ("# heading\n\nbogus $t0\nhalt\n", "assembly", 3),
            ("li $t0, 1\nlw $t1, 1($zero)\nhalt\n", "reference", 2),
        ]:
            with self.subTest(phase=phase):
                self.source.write_text(source, encoding="utf-8")
                result = invoke("execute", self.source, 100, 100)
                self.assertNotEqual(result.returncode, 0)
                value = json.loads(result.stdout)
                self.assertEqual(
                    (value["status"], value["phase"], value["line"]), ("error", phase, line)
                )

    def test_finite_limits_bad_types_and_nontermination_never_produce_verified_reports(self):
        self.source.write_text("spin: j spin\n", encoding="utf-8")
        result = invoke("execute", self.source, 100, 10)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)["status"], "error")
        for raw in (b"\xff", b"h" * (128 * 1024 + 1)):
            self.source.write_bytes(raw)
            result = invoke("execute", self.source, 100, 10)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")

    def test_independent_lru_hits_and_true_empty_sample(self):
        self.source.write_text("0 4 8 0 16 8 0", encoding="utf-8")
        result = invoke("cache", 2, 2, 4, self.source)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual((value["accesses"], value["hits"], value["misses"]), (7, 1, 6))
        self.assertEqual(
            [item["hit"] for item in value["observations"]],
            [False, False, False, True, False, False, False],
        )
        self.source.write_text("", encoding="utf-8")
        value = json.loads(invoke("cache", 2, 2, 4, self.source).stdout)
        self.assertEqual((value["accesses"], value["hitRatio"], value["observations"]), (0, 0, []))

    def test_invalid_cache_shape_is_a_cache_diagnostic(self):
        self.source.write_text("0 4", encoding="utf-8")
        result = invoke("cache", 2, 2, 3, self.source)
        self.assertNotEqual(result.returncode, 0)
        value = json.loads(result.stdout)
        self.assertEqual(
            (value["kind"], value["status"], value["phase"]), ("cache", "error", "cache")
        )


if __name__ == "__main__":
    unittest.main()
