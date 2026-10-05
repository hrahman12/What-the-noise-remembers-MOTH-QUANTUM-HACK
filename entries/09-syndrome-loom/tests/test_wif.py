from loom import weave, wif


def test_roundtrip_and_format():
    w = weave.sample([[0, 1, 0], [1, 1, 0]], {"L0": 0.1, "L1": 0.1, "s": 0.7}, seed=8)
    cells, weft = weave.drawdown(w)
    text = wif.to_wif(cells, weft, title="t", notes=["a note"])
    text.encode("ascii")
    assert text.startswith("[WIF]\r\nVersion=1.1\r\n")
    parsed = wif.parse(text)
    for sec in ("WIF", "CONTENTS", "WEAVING", "WARP", "WEFT", "COLOR PALETTE", "COLOR TABLE",
                "THREADING", "LIFTPLAN", "WEFT COLORS", "TEXT", "NOTES"):
        assert sec in parsed, sec
        if sec not in ("WIF", "CONTENTS"):
            assert parsed["CONTENTS"].get(sec) == "true", sec
    assert parsed["WEAVING"]["Shafts"] == str(len(cells[0]))
    assert parsed["WEFT"]["Threads"] == str(len(cells))
    back_cells, back_weft = wif.drawdown_from(parsed)
    assert back_cells == cells and back_weft == weft
