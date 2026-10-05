import json

import pytest
from PIL import Image

from loom import calibration, cli, wif

from conftest import PIECE

DEMO = PIECE / "demo" / "moth.png"


def test_weave_writes_three_files(tmp_path, toy_cal):
    cal = tmp_path / "cal.json"
    cal.write_text(json.dumps(toy_cal))
    out = tmp_path / "out"
    rc = cli.main(["weave", str(DEMO), "--p", "5e-3", "--width", "16", "--out", str(out),
                   "--calibration", str(cal), "--cell", "4"])
    assert rc == 0
    text = (out / "draft.wif").read_text(encoding="ascii")
    cells, weft = wif.drawdown_from(wif.parse(text))
    assert len(cells[0]) == 16 * 7 and len(cells) % 7 == 0
    im = Image.open(out / "render.png")
    assert im.size == (16 * 7 * 4, len(cells) * 4)
    rep = (out / "report.md").read_text(encoding="utf-8")
    assert "Logical vs physical" in rep and "| 0.005 |" in rep


def test_uncalibrated_p_is_refused(tmp_path, toy_cal):
    cal = tmp_path / "cal.json"
    cal.write_text(json.dumps(toy_cal))
    assert cli.main(["weave", str(DEMO), "--p", "0.3", "--out", str(tmp_path), "--calibration", str(cal)]) == 2


def test_bundled_calibration_is_engine_data():
    """The shipped rates must come from completed tamagotchi-v1 jobs (UUID job ids, rates in [0, 1])."""
    cal = calibration.load()
    assert cal["engine"] == "tamagotchi-v1"
    for prof in ("loom", "thread"):
        lvs = calibration.levels(cal, prof)
        assert [lv["p"] for lv in lvs] == [1e-3, 5e-3, 1e-2]
        for lv in lvs:
            for key in ("se", "bare"):
                job = lv[key]["job_id"]
                assert len(job) == 36 and job.count("-") == 4
                assert 0 <= lv[key]["logical_error_rate"] <= 1
            assert 0 <= lv["se"]["syndrome_rate"] <= 1
            assert set(calibration.rates(lv)) == {"L0", "L1", "s"}


def test_bundled_jobs_exist_in_atlas_cache():
    cache = PIECE.parent.parent / "cache" / "tamagotchi-v1"
    if not cache.exists():
        pytest.skip("Atlas cache not present (package installed outside the project)")
    ids = {json.loads(p.read_text(encoding="utf-8"))["job_id"] for p in cache.glob("*.json")}
    cal = calibration.load()
    for prof in cal["profiles"].values():
        for lv in prof["levels"]:
            assert lv["se"]["job_id"] in ids and lv["bare"]["job_id"] in ids
