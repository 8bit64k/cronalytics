"""Runtime state location + one-time migration out of the plugin directory (issue #10)."""

import importlib.util
import json
import sqlite3
import sys
from pathlib import Path

import pytest

_CONFIG = Path(__file__).resolve().parent.parent / "cronalytics" / "config.py"


def _load_config(home: Path, monkeypatch, data_dir: Path | None = None):
    """Execute config.py fresh against *home*, as a new gateway process would."""
    monkeypatch.setattr(sys.modules["hermes_constants"], "get_hermes_home", lambda: str(home))
    if data_dir is None:
        monkeypatch.delenv("CRONALYTICS_DATA_DIR", raising=False)
    else:
        monkeypatch.setenv("CRONALYTICS_DATA_DIR", str(data_dir))
    spec = importlib.util.spec_from_file_location("cronalytics_config_under_test", _CONFIG)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _seed_legacy(home: Path) -> Path:
    plugin = home / "plugins" / "cronalytics"
    plugin.mkdir(parents=True)
    con = sqlite3.connect(plugin / "facts.db")
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("CREATE TABLE t (v INTEGER)")
    con.executemany("INSERT INTO t VALUES (?)", [(i,) for i in range(5)])
    con.commit()
    con.close()
    (plugin / "watermark.json").write_text(json.dumps({"last_ended_at": 42.0}))
    (plugin / "pending.jsonl").write_text('{"session_id": "s1"}\n')
    return plugin


def test_state_paths_live_outside_plugin_dir(tmp_path, monkeypatch):
    config = _load_config(tmp_path, monkeypatch)
    data = tmp_path / "plugin-data" / "cronalytics"
    assert data == config.DATA_DIR
    assert data / "facts.db" == config.FACT_DB
    assert data / "watermark.json" == config.WATERMARK_FILE
    assert data / "pending.jsonl" == config.PENDING_FILE
    assert config.PLUGIN_DIR not in config.FACT_DB.parents


def test_data_dir_env_override(tmp_path, monkeypatch):
    custom = tmp_path / "elsewhere"
    config = _load_config(tmp_path, monkeypatch, data_dir=custom)
    assert custom / "facts.db" == config.FACT_DB


def test_legacy_state_is_migrated_and_moved_aside(tmp_path, monkeypatch):
    plugin = _seed_legacy(tmp_path)
    config = _load_config(tmp_path, monkeypatch)

    con = sqlite3.connect(config.FACT_DB)
    assert con.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 5
    assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    con.close()
    assert json.loads(config.WATERMARK_FILE.read_text()) == {"last_ended_at": 42.0}
    assert config.PENDING_FILE.read_text() == '{"session_id": "s1"}\n'

    # The plugin directory holds code only afterwards.
    assert not [p for p in plugin.iterdir() if p.name in config._LEGACY_FILES]
    aside = list(config.DATA_DIR.glob("legacy-*"))
    assert len(aside) == 1 and (aside[0] / "facts.db").exists()


def test_existing_data_dir_wins_and_reload_is_idempotent(tmp_path, monkeypatch):
    data = tmp_path / "plugin-data" / "cronalytics"
    data.mkdir(parents=True)
    sqlite3.connect(data / "facts.db").execute("CREATE TABLE kept (v INTEGER)").connection.commit()
    plugin = _seed_legacy(tmp_path)

    config = _load_config(tmp_path, monkeypatch)
    tables = {r[0] for r in sqlite3.connect(config.FACT_DB).execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert tables == {"kept"}  # never overwritten by legacy state
    assert not (plugin / "facts.db").exists()

    before = sorted(p.name for p in data.iterdir())
    _load_config(tmp_path, monkeypatch)
    assert sorted(p.name for p in data.iterdir()) == before


@pytest.mark.parametrize("missing", ["facts.db", "watermark.json"])
def test_partial_legacy_state(tmp_path, monkeypatch, missing):
    plugin = _seed_legacy(tmp_path)
    for name in (missing, f"{missing}-wal", f"{missing}-shm"):
        (plugin / name).unlink(missing_ok=True)
    config = _load_config(tmp_path, monkeypatch)
    assert config.PENDING_FILE.exists()
    assert not [p for p in plugin.iterdir() if p.name in config._LEGACY_FILES]
