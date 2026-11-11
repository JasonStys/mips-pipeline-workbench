"""File: Tests adversarial protocol/resource/workspace boundaries without submitted host execution.

Actual source-mode resources, regular files and SQLite are used; malformed trusted-child outputs
are injected only to test refusal. Exact functions and variables are in docs/code-index.md.
"""

import hashlib
import json
import os
import subprocess
import sys
from types import SimpleNamespace

import pytest
from test_studio_service import CACHE, EXECUTION

from mips_studio import resources, store
from mips_studio.engine import MAX_OUTPUT, Engine
from mips_studio.server import Handler


@pytest.mark.parametrize(
    "output,code",
    [
        (b"not JSON", 0),
        (b"\xff", 0),
        (b"[]", 0),
        (b"{}", 0),
        (b'{"schemaVersion":2}', 0),
        (b'{"schemaVersion":1}', 7),
        (b'{"schemaVersion":1,"status":"error"}', 0),
        (b"x" * (MAX_OUTPUT + 1), 0),
    ],
    ids=[
        "not-json",
        "invalid-utf8",
        "array",
        "missing-schema",
        "wrong-schema",
        "bad-exit",
        "contradictory-exit",
        "oversized-output",
    ],
)
def test_child_output_refused_without_success_evidence(monkeypatch, engine, output, code):
    def result(arguments, **kwargs):
        assert arguments[0] == str(engine.executable) and arguments[1] == "studio"
        assert kwargs["timeout"] == 15 and kwargs["stdin"] == subprocess.DEVNULL
        assert "shell" not in kwargs and "PYTHONPATH" not in kwargs["env"]
        kwargs["stdout"].write(output)
        return SimpleNamespace(returncode=code)

    monkeypatch.setattr(subprocess, "run", result)
    with pytest.raises(ValueError):
        engine._invoke(["version"])


def test_engine_identity_and_result_status_are_independently_required(engine, monkeypatch):
    with pytest.raises(ValueError, match="source identity"):
        Engine(engine.executable, "a" * 39, engine.sha256)
    with pytest.raises(ValueError, match="digest"):
        Engine(engine.executable, "development", "0" * 64)
    monkeypatch.setattr(Engine, "_invoke", lambda *_: {"schemaVersion": 1, "sourceCommit": "wrong"})
    with pytest.raises(ValueError, match="product/version/source"):
        Engine(engine.executable, "development", engine.sha256)


@pytest.mark.parametrize(
    "report,value",
    [
        ({"kind": "cache", "status": "completed"}, EXECUTION),
        ({"kind": "execution", "status": "verified", "equivalent": False}, EXECUTION),
        ({"kind": "execution", "status": "success", "equivalent": True}, EXECUTION),
        ({"kind": "execution", "status": "verified", "equivalent": 1}, EXECUTION),
        ({"kind": "cache", "status": "verified"}, CACHE),
    ],
)
def test_exit_zero_or_forged_status_cannot_be_called_verified(monkeypatch, engine, report, value):
    monkeypatch.setattr(engine, "_invoke", lambda _: report)
    with pytest.raises(ValueError):
        engine.run(value)


def test_stderr_bound_and_owned_timeout_propagate(monkeypatch, engine):
    def excess(_args, **kwargs):
        kwargs["stdout"].write(b'{"schemaVersion":1}')
        kwargs["stderr"].write(b"x" * 4097)
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(subprocess, "run", excess)
    with pytest.raises(ValueError, match="diagnostic exceeded"):
        engine._invoke(["version"])

    def expired(*_args, **_kwargs):
        raise subprocess.TimeoutExpired("fixed-owned-engine", 15)

    monkeypatch.setattr(subprocess, "run", expired)
    with pytest.raises(subprocess.TimeoutExpired):
        engine.run(CACHE)


def test_source_resources_are_actual_built_engine_and_static_assets():
    actual, assets, metadata = resources.load_resources()
    assert actual.identity["sourceCommit"] == "development"
    assert metadata["version"] == "1.1.0" and set(assets) == {
        "/",
        *("/" + name for name in resources.ASSETS),
    }
    assert b"Native assembly and cache studio" in assets["/"][1]
    assert b"Run assembly" in assets["/"][1]


def packaged_context(tmp_path, monkeypatch, engine):
    root = tmp_path / "native"
    root.mkdir()
    (root / "mips_studio").mkdir()
    monkeypatch.setattr(resources, "__file__", str(root / "mips_studio/resources.py"))
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(resources, "Engine", lambda *_: engine)
    metadata = {
        "product": "mips-pipeline-workbench",
        "version": "1.1.0",
        "sourceCommit": "a" * 40,
        "pythonVersion": resources.platform.python_version(),
        "engineSha256": engine.sha256,
        "assets": {},
    }
    for name in resources.ASSETS:
        path = root / "web" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = ("inert fixed resource " + name).encode()
        path.write_bytes(raw)
        metadata["assets"][name] = hashlib.sha256(raw).hexdigest()
    return root, metadata


@pytest.mark.parametrize(
    "field,value",
    [
        ("product", "other"),
        ("version", "1.0.0"),
        ("sourceCommit", "a" * 39),
        ("sourceCommit", None),
        ("pythonVersion", "3.14.6"),
        ("assets", {}),
    ],
)
def test_packaged_source_version_inventory_refusals_before_profile(
    tmp_path, monkeypatch, engine, field, value
):
    root, metadata = packaged_context(tmp_path, monkeypatch, engine)
    metadata[field] = value
    (root / "RELEASE.json").write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match="does not match"):
        resources.load_resources()
    assert not (tmp_path / "profile").exists()


def test_packaged_resource_digest_and_security_floor(tmp_path, monkeypatch, engine):
    root, metadata = packaged_context(tmp_path, monkeypatch, engine)
    (root / "RELEASE.json").write_text(json.dumps(metadata))
    assert resources.load_resources()[2] == metadata
    (root / "web/assets/studio.js").write_text("tampered inert bytes")
    with pytest.raises(ValueError, match="digest"):
        resources.load_resources()
    monkeypatch.setattr(sys, "version_info", (3, 14, 6))
    with pytest.raises(ValueError, match="patched Python"):
        resources.load_resources()


def test_resource_bounds_and_actual_growth_refuse(tmp_path, monkeypatch):
    path = tmp_path / "resource"
    path.write_bytes(b"abcd")
    assert resources.bounded(path, 4) == b"abcd"
    with pytest.raises(ValueError, match="bounded file"):
        resources.bounded(path, 3)
    real_stat = os.fstat

    def shorter(descriptor):
        info = real_stat(descriptor)
        return SimpleNamespace(st_mode=info.st_mode, st_size=3)

    monkeypatch.setattr(os, "fstat", shorter)
    with pytest.raises(ValueError, match="changed"):
        resources.bounded(path, 4)


@pytest.mark.parametrize(
    "marker",
    [
        [],
        {},
        {"schema_version": True, "product": "mips-pipeline-workbench"},
        {"schema_version": 2, "product": "mips-pipeline-workbench"},
        {"schema_version": 1, "product": "other"},
    ],
)
def test_profile_identity_is_exact_not_truthy(tmp_path, marker):
    directory = tmp_path / "profile"
    directory.mkdir()
    path = directory / "profile.json"
    path.write_text(json.dumps(marker))
    before = path.read_bytes()
    with pytest.raises(ValueError):
        store.Profile(directory)
    assert path.read_bytes() == before and list(directory.iterdir()) == [path]


def test_history_bounds_rollback_and_explicit_delete(live, monkeypatch):
    host, client = live
    for body in (
        {},
        {"title": "", "input": CACHE},
        {"title": "x" * 101, "input": CACHE},
        {"title": False, "input": CACHE},
    ):
        assert client.post("/api/run", json=body).status_code == 400
    record = client.post("/api/run", json={"title": "Retained", "input": CACHE}).json()
    for query in ("?q=" + "x" * 101, "?page=-1", "?page=41", "?q=a&kind=cache&page=0&extra=a"):
        assert client.get("/api/history" + query).status_code == 400
    assert client.post("/api/delete", json={"id": False}).status_code == 400
    assert client.post("/api/delete", json={"id": "a" * 32}).status_code == 404
    assert client.post("/not-an-api", json={}).status_code == 404
    monkeypatch.setattr(store, "MAX_RECORDS", 1)
    assert (
        client.post("/api/run", json={"title": "No silent pruning", "input": CACHE}).status_code
        == 400
    )
    assert client.get("/api/history").json()["total"] == 1
    assert client.get("/api/history/" + record["id"]).json() == record
    monkeypatch.setattr(store, "MAX_RECORDS", 1000)
    monkeypatch.setattr(store, "MAX_HISTORY_BYTES", 1)
    assert (
        client.post("/api/run", json={"title": "No hidden disk growth", "input": CACHE}).status_code
        == 400
    )
    assert client.get("/api/history/" + record["id"]).json() == record
    assert client.post("/api/delete", json={"id": record["id"]}).status_code == 200
    assert client.get("/api/history").json()["total"] == 0
    assert client.post("/api/quit", json={"quit": True}).status_code == 200
    assert host.stop_requested.is_set()


def test_unsupported_http_methods_are_policy_bound_and_do_not_echo(live):
    _host, client = live
    for method in ("OPTIONS", "PUT", "TRACE"):
        result = client.request(method, "/api/history")
        assert result.status_code == 501
        assert "default-src 'none'" in result.headers["content-security-policy"]
        assert result.json() == {"error": "Unsupported or malformed HTTP request"}


def test_quit_acknowledgment_records_the_request_before_any_response_bytes(live, monkeypatch):
    host, client = live
    observed = []
    actual_reply = Handler.reply

    def reply(handler, status, value):
        if status == 200 and value == {"closing": True}:
            observed.append(host.stop_requested.is_set())
        return actual_reply(handler, status, value)

    monkeypatch.setattr(Handler, "reply", reply)
    assert client.post("/api/quit", json={"quit": True}).status_code == 200
    assert observed == [True]


def test_engine_failure_and_capacity_do_not_create_successes(live, monkeypatch):
    host, client = live

    def fail(_value):
        raise subprocess.TimeoutExpired("fixed-owned-child", 15)

    monkeypatch.setattr(host.engine, "run", fail)
    assert client.post("/api/run", json={"title": "Failure", "input": CACHE}).status_code == 500
    assert client.get("/api/history").json()["total"] == 0
    for _ in range(4):
        assert host.slots.acquire(blocking=False)
    try:
        assert client.post("/api/run", json={"title": "Busy", "input": CACHE}).status_code == 429
    finally:
        for _ in range(4):
            host.slots.release()


def test_invalid_direct_store_arguments_rollback(live):
    host, _client = live
    with pytest.raises(ValueError, match="Diagnostics"):
        host.profile.store.save("bad", CACHE, {"status": "error"}, {})
    for title in (None, "", "x" * 101):
        with pytest.raises(ValueError):
            host.profile.store.save(title, CACHE, {"status": "completed"}, {})
    with pytest.raises(ValueError):
        host.profile.store.history(page=True)
    assert host.profile.store.history()["total"] == 0
