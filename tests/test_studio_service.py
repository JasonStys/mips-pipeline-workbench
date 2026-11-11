"""File: Verifies native workflows with real Rust, SQLite and HTTP sockets.

Hand-derived state/LRU oracles and refusal tests preserve previously accepted evidence.
Exact declaration lines are generated in docs/code-index.md. All inputs/workspaces are synthetic.
"""

import http.client
import json
import sqlite3
import sys
import threading
from contextlib import closing
from pathlib import Path

import pytest

from mips_studio.engine import request
from mips_studio.store import Profile, default_directory

ROOT = Path(__file__).resolve().parents[1]
ASSEMBLY = "li $t0, 64\nli $t1, 5\nsw $t1, 0($t0)\nlw $t2, 0($t0)\naddu $t3, $t2, $t1\nhalt\n"
EXECUTION = {"kind": "execution", "source": ASSEMBLY, "maxCycles": 1000, "retainedCycles": 100}
CACHE = {"kind": "cache", "sets": 2, "ways": 2, "lineBytes": 4, "addresses": [0, 4, 8, 0, 16, 8, 0]}


def test_actual_reference_pipeline_and_cache_oracles_saved_reopened_exportable(live):
    host, client = live
    response = client.post(
        "/api/run", json={"title": "Cold-chain controller exercise", "input": EXECUTION}
    )
    assert response.status_code == 201
    evidence = response.json()
    report = evidence["report"]
    assert report["status"] == "verified" and report["equivalent"] is True
    assert report["trace"]["registers"][8:12] == [64, 5, 5, 10]
    assert report["reference"]["finalPc"] == report["trace"]["summary"]["finalPc"] == 24
    # The original public trace schema intentionally renders CPI to four decimal places.
    assert report["trace"]["summary"] == {
        "cycles": 11,
        "retired": 6,
        "stalls": 1,
        "flushes": 2,
        "cpi": 1.8333,
        "finalPc": 24,
    }
    assert {entry["address"]: entry["word"] for entry in report["pipelineMemory"]}[64] == 5
    assert report["listing"][0] == {"address": 0, "line": 1, "word": 0x24080040}
    assert evidence["engine"]["sha256"] == host.engine.sha256
    assert client.get("/api/history/" + evidence["id"]).json() == evidence
    cache = client.post("/api/run", json={"title": "LRU six misses", "input": CACHE}).json()
    assert cache["report"]["hits"] == 1 and cache["report"]["misses"] == 6
    assert [row["hit"] for row in cache["report"]["observations"]] == [
        False,
        False,
        False,
        True,
        False,
        False,
        False,
    ]
    assert client.get("/api/history?kind=cache").json()["total"] == 1
    assert client.get("/api/history?q=Cold-chain").json()["items"][0]["id"] == evidence["id"]


def test_model_mismatch_is_honest_not_process_exit_success(live):
    _host, client = live
    value = {**EXECUTION, "source": "li $t0,0\nsw $t0,12($zero)\nnop\nli $t1,7\nhalt"}
    response = client.post(
        "/api/run", json={"title": "Self-modification discrepancy", "input": value}
    )
    assert response.status_code == 201
    report = response.json()["report"]
    assert report["status"] == "mismatch" and report["equivalent"] is False
    assert report["reference"]["registers"][9] == 0 and report["trace"]["registers"][9] == 7


@pytest.mark.parametrize(
    "source,phase,line",
    [
        ("# line one\n\nwrong $t0", "assembly", 3),
        ("li $t0,1\nlw $t1,1($zero)\nhalt", "reference", 2),
        ("loop: j loop", "reference", 1),
    ],
)
def test_real_diagnostics_keep_physical_location_and_do_not_save(live, source, phase, line):
    _host, client = live
    response = client.post(
        "/api/run",
        json={"title": "Fault", "input": {**EXECUTION, "source": source, "maxCycles": 20}},
    )
    assert response.status_code == 422
    assert response.json()["diagnostic"]["phase"] == phase
    assert response.json()["diagnostic"]["line"] == line
    assert client.get("/api/history").json()["total"] == 0


@pytest.mark.parametrize(
    "value",
    [
        None,
        [],
        {},
        {**EXECUTION, "source": ""},
        {**EXECUTION, "source": "x" * (128 * 1024 + 1)},
        {**EXECUTION, "maxCycles": True},
        {**EXECUTION, "maxCycles": 0},
        {**EXECUTION, "retainedCycles": -1},
        {**EXECUTION, "extra": 1},
        {**CACHE, "sets": 0},
        {**CACHE, "ways": 9},
        {**CACHE, "lineBytes": 3},
        {**CACHE, "addresses": [False]},
        {**CACHE, "addresses": [-1]},
        {**CACHE, "addresses": [0x100000000]},
        {**CACHE, "addresses": [0] * 10001},
        {**CACHE, "addresses": "0"},
        {"kind": "shell", "command": "inert"},
    ],
)
def test_input_boundary_rejects_ambiguous_coerced_or_unbounded_values(value):
    with pytest.raises(ValueError):
        request(value)


def test_empty_cache_and_zero_trace_are_valid_missingness_not_false_measurements(live):
    _host, client = live
    cache = client.post(
        "/api/run", json={"title": "No accesses", "input": {**CACHE, "addresses": []}}
    ).json()
    assert (
        cache["report"]["accesses"] == 0
        and cache["report"]["observations"] == []
        and cache["report"]["hitRatio"] == 0
    )
    run = client.post(
        "/api/run", json={"title": "Final-state only", "input": {**EXECUTION, "retainedCycles": 0}}
    ).json()
    assert (
        run["report"]["trace"]["cycles"] == [] and run["report"]["trace"]["summary"]["cycles"] == 11
    )


def test_real_authority_capability_origin_and_csp_controls(live):
    host, client = live
    assert client.get("/").headers["content-security-policy"].startswith("default-src 'none'")
    health = client.get("/health").json()
    assert health["nonce"] == host.nonce and health["version"] == "1.1.0"
    assert "capability" not in health and "workspace" not in json.dumps(health)
    for headers in (
        {"X-Mips-Capability": ""},
        {"X-Mips-Capability": "wrong"},
        {"Host": "localhost"},
        {"Sec-Fetch-Site": "cross-site"},
    ):
        assert client.get("/api/history", headers=headers).status_code == 403
    assert client.get("/../../profile.json").status_code == 404
    assert client.get("/assets/not-in-manifest.js").status_code == 404
    assert client.get("/api/history?kind=wrong").status_code == 400
    assert client.get("/api/history?q=a&q=b").status_code == 400
    assert client.get("/api/history?page=NaN").status_code == 400
    assert client.get("/api/history/not-a-file").status_code == 400
    assert client.get("/api/history/" + "a" * 32).status_code == 404
    assert client.get("/api/history").json()["total"] == 0


@pytest.mark.parametrize(
    "raw,headers",
    [
        (b'{"quit":true,"quit":false}', {}),
        (b'{"x":NaN}', {}),
        (b"[]", {}),
        (b"\xff", {}),
    ],
)
def test_real_json_parser_refuses_duplicate_nonfinite_wrong_framing(live, raw, headers):
    _host, client = live
    response = client.post(
        "/api/quit", content=raw, headers={"Content-Type": "application/json", **headers}
    )
    assert response.status_code == 400


def test_wrong_capability_and_origin_refused_before_large_body_is_sent(live):
    host, _client = live
    for capability, origin in (
        ("wrong", host.origin),
        (host.capability, "https://example.invalid"),
        (host.capability, ""),
        (host.capability, host.origin + "/"),
    ):
        connection = http.client.HTTPConnection("127.0.0.1", host.server.server_port, timeout=2)
        try:
            connection.putrequest("POST", "/api/quit")
            for name, value in {
                "X-Mips-Capability": capability,
                "Origin": origin,
                "Content-Type": "application/json",
                "Content-Length": "262144",
            }.items():
                connection.putheader(name, value)
            connection.endheaders()
            assert connection.getresponse().status == 403
        finally:
            connection.close()


@pytest.mark.parametrize(
    "headers",
    [
        {"Content-Type": "text/plain"},
        {"Content-Encoding": "gzip"},
        {"Content-Length": "262145"},
        {"Transfer-Encoding": "chunked"},
    ],
)
def test_wrong_framing_refused_before_body_is_sent(live, headers):
    host, _client = live
    connection = http.client.HTTPConnection("127.0.0.1", host.server.server_port, timeout=2)
    try:
        connection.putrequest("POST", "/api/quit")
        for name, value in {
            "X-Mips-Capability": host.capability,
            "Origin": host.origin,
            "Content-Type": "application/json",
            "Content-Length": "2",
            **headers,
        }.items():
            connection.putheader(name, value)
        connection.endheaders()
        assert connection.getresponse().status == 400
    finally:
        connection.close()


def test_history_literal_filters_pages_exact_export_delete_and_reopen(tmp_path, engine):
    profile = Profile(tmp_path / "workspace")
    report = engine.run(CACHE)
    identity = {**engine.identity, "sha256": engine.sha256}
    records = [
        profile.store.save(
            f"Record {index}" if index != 3 else "literal %_\\ title", CACHE, report, identity
        )
        for index in range(31)
    ]
    assert profile.store.history()["total"] == 31
    assert len(profile.store.history()["items"]) == 25
    assert len(profile.store.history(page=1)["items"]) == 6
    assert (
        len(
            {
                row["id"]
                for row in profile.store.history()["items"] + profile.store.history(page=1)["items"]
            }
        )
        == 31
    )
    assert profile.store.history("%_\\")["items"][0]["id"] == records[3]["id"]
    original = profile.store.get(records[5]["id"])
    profile.close()
    reopened = Profile(tmp_path / "workspace")
    try:
        assert reopened.store.get(records[5]["id"]) == original
        reopened.store.delete(records[5]["id"])
        assert reopened.store.history()["total"] == 30
        with pytest.raises(KeyError):
            reopened.store.get(records[5]["id"])
    finally:
        reopened.close()


def test_unknown_workspace_exclusive_lock_and_future_schema_preserve_bytes(tmp_path):
    unknown = tmp_path / "unknown"
    unknown.mkdir()
    (unknown / "retain.txt").write_text("sentinel")
    with pytest.raises(ValueError, match="Unknown nonempty"):
        Profile(unknown)
    assert list(unknown.iterdir()) == [unknown / "retain.txt"]
    owner = Profile(tmp_path / "known")
    with pytest.raises(OSError):
        Profile(tmp_path / "known")
    owner.close()
    database_path = tmp_path / "known/workspace.sqlite3"
    with closing(sqlite3.connect(database_path)) as connection:
        connection.execute("PRAGMA user_version = 99")
        connection.commit()
    before = database_path.read_bytes()
    with pytest.raises(ValueError, match="Unsupported workspace schema"):
        Profile(tmp_path / "known")
    assert database_path.read_bytes() == before


def test_close_waits_for_actual_owned_request_and_retains_workspace_lock(live, monkeypatch):
    host, client = live
    entered, release, completed = threading.Event(), threading.Event(), threading.Event()
    real_run = host.engine.run

    def held(value):
        entered.set()
        if not release.wait(5):
            raise AssertionError("Test did not release owned request")
        return real_run(value)

    monkeypatch.setattr(host.engine, "run", held)
    results = []
    request_thread = threading.Thread(
        target=lambda: results.append(
            client.post("/api/run", json={"title": "Held actual request", "input": CACHE})
        )
    )
    request_thread.start()
    assert entered.wait(3)
    close_thread = threading.Thread(target=lambda: (host.close(), completed.set()))
    close_thread.start()
    try:
        with pytest.raises(OSError):
            Profile(host.profile.directory)
        assert not completed.is_set()
    finally:
        release.set()
        request_thread.join(5)
        close_thread.join(5)
    assert completed.is_set() and results[0].status_code == 201
    reopened = Profile(host.profile.directory)
    assert reopened.store.history()["total"] == 1
    reopened.close()


def test_default_directory_is_os_local_and_absolute(monkeypatch, tmp_path):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    assert default_directory().is_absolute()
    if sys.platform != "darwin":
        assert default_directory().is_relative_to(tmp_path)
