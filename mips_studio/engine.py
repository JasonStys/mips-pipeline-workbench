"""File: Invokes only the fixed bundled Rust educational engine with bounded inputs.

Engine owns the executable identity, source/configuration validation and finite subprocess work.
Variables: MAX_SOURCE/MAX_OUTPUT bound bytes; requests never supply a binary, shell or device.
Major symbols and exact declaration lines are generated in docs/code-index.md.
"""

import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from mips_studio import __version__

MAX_SOURCE = 128 * 1024
MAX_OUTPUT = 8 * 1024 * 1024


def integer(value: object, minimum: int, maximum: int, name: str) -> int:
    """Reject booleans/coercions and values outside a model's explicit numerical budget."""
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError(f"{name} must be an integer from {minimum} to {maximum}")
    return value


def request(value: object) -> dict:
    """Accept one exact execution or independent-cache input schema before touching the engine."""
    if not isinstance(value, dict):
        raise ValueError("Provide an input object")
    kind = value.get("kind")
    if kind == "execution":
        if set(value) != {"kind", "source", "maxCycles", "retainedCycles"}:
            raise ValueError("Unexpected execution fields")
        source = value["source"]
        if not isinstance(source, str) or not source.strip() or len(source.encode()) > MAX_SOURCE:
            raise ValueError("Assembly must be nonempty UTF-8 text of at most 128 KiB")
        integer(value["maxCycles"], 1, 10_000, "Cycle budget")
        integer(value["retainedCycles"], 0, 10_000, "Retained cycles")
    elif kind == "cache":
        if set(value) != {"kind", "sets", "ways", "lineBytes", "addresses"}:
            raise ValueError("Unexpected cache fields")
        integer(value["sets"], 1, 64, "Sets")
        integer(value["ways"], 1, 8, "Ways")
        size = integer(value["lineBytes"], 1, 256, "Line bytes")
        if size & (size - 1):
            raise ValueError("Line bytes must be a power of two")
        addresses = value["addresses"]
        if not isinstance(addresses, list) or len(addresses) > 10_000:
            raise ValueError("Provide at most 10000 cache byte addresses")
        for address in addresses:
            integer(address, 0, 0xFFFFFFFF, "Address")
    else:
        raise ValueError("Choose execution or cache")
    return value.copy()


class Engine:
    """A trusted fixed Rust binary; an untrusted input cannot change its executable or command."""

    def __init__(self, executable: Path, source: str, expected_sha256: str):
        """Bind actual binary bytes and its compiled product/source response before opening data."""
        if source != "development" and re.fullmatch(r"[a-f0-9]{40}", source) is None:
            raise ValueError("Invalid engine source identity")
        self.executable = executable.resolve(strict=True)
        self.sha256 = hashlib.sha256(self.executable.read_bytes()).hexdigest()
        if self.sha256 != expected_sha256:
            raise ValueError("Rust engine digest does not match this application")
        self.source = source
        self.identity = self._invoke(["version"])
        if self.identity != {
            "schemaVersion": 1,
            "name": "mips-pipeline-workbench",
            "version": __version__,
            "sourceCommit": source,
        }:
            raise ValueError("Rust engine product/version/source does not match this application")

    def _invoke(self, arguments: list[str]) -> dict:
        "Use fixed arguments, a clean loader environment and bounded output reads."
        environment = os.environ.copy()
        for name in ("PYTHONPATH", "PYTHONHOME", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"):
            environment.pop(name, None)
        # The known kernel has input/cycle/trace bounds. Files avoid unbounded capture allocation;
        # A finite timeout kills and waits for the owned child before releasing its files.
        with tempfile.TemporaryDirectory(prefix="mips-engine-") as directory:
            with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
                result = subprocess.run(
                    [str(self.executable), "studio", *arguments],
                    cwd=directory,
                    stdin=subprocess.DEVNULL,
                    stdout=output,
                    stderr=errors,
                    timeout=15,
                    check=False,
                    env=environment,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                output.seek(0)
                raw = output.read(MAX_OUTPUT + 1)
                errors.seek(0)
                diagnostic = errors.read(4097)
        if len(raw) > MAX_OUTPUT:
            raise ValueError("Rust output exceeds its 8 MiB evidence bound")
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError) as error:
            raise ValueError("Rust engine returned no valid bounded JSON result") from error
        if not isinstance(value, dict) or value.get("schemaVersion") != 1:
            raise ValueError("Unexpected Rust result schema")
        if result.returncode != 0 and value.get("status") != "error":
            raise ValueError("Rust process failed without a structured diagnostic")
        if result.returncode == 0 and value.get("status") == "error":
            raise ValueError("Rust exit status contradicts its diagnostic")
        if len(diagnostic) > 4096:
            raise ValueError("Rust diagnostic exceeded its bound")
        return value

    def run(self, value: object) -> dict:
        """Execute validated inputs; zero exit alone is never treated as architectural agreement."""
        value = request(value)
        with tempfile.TemporaryDirectory(prefix="mips-input-") as directory:
            path = Path(directory) / "input.txt"
            if value["kind"] == "execution":
                path.write_text(value["source"], encoding="utf-8")
                args = ["execute", str(path), str(value["maxCycles"]), str(value["retainedCycles"])]
            else:
                path.write_text(" ".join(map(str, value["addresses"])), encoding="ascii")
                args = [
                    "cache",
                    str(value["sets"]),
                    str(value["ways"]),
                    str(value["lineBytes"]),
                    str(path),
                ]
            report = self._invoke(args)
        if report.get("kind") != value["kind"]:
            raise ValueError("Rust result kind does not match the requested experiment")
        status = report.get("status")
        if status == "error":
            return report
        if value["kind"] == "execution":
            if status not in ("verified", "mismatch") or type(report.get("equivalent")) is not bool:
                raise ValueError("Execution has no explicit independent-model comparison")
            if (status == "verified") != report["equivalent"]:
                raise ValueError("Execution status contradicts its model comparison")
        elif status != "completed":
            raise ValueError("Cache experiment did not complete")
        return report
