"""Download the real GW150914 strain (H1 and L1, 32 s, 4 kHz HDF5) from GWOSC. CLASSICAL.

Source: GWOSC event release GWTC-1-confident / GW150914 / v3, located with the `gwosc` package.
Licence: CC BY 4.0 (stated on https://gwosc.org/data/ and on the event page). See CREDITS.md.
Files are cached in data/ and never re-downloaded; data/sources.json records URL + sha256.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import requests
from gwosc.locate import get_event_urls

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
EVENT, CATALOG, DURATION, RATE = "GW150914", "GWTC-1-confident", 32, 4096


def fetch() -> dict:
    DATA.mkdir(exist_ok=True)
    src_path = DATA / "sources.json"
    sources = json.loads(src_path.read_text(encoding="utf-8")) if src_path.exists() else {}
    for det in ("H1", "L1"):
        local = [p for p in DATA.glob(f"{det[0]}-{det}_GWOSC_4KHZ_*-32.hdf5")]
        if local and det in sources:
            continue
        (url,) = get_event_urls(EVENT, duration=DURATION, detector=det, sample_rate=RATE, catalog=CATALOG)
        name = url.rsplit("/", 1)[1]
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        (DATA / name).write_bytes(r.content)
        sources[det] = {"url": url, "file": name, "bytes": len(r.content),
                        "sha256": hashlib.sha256(r.content).hexdigest(),
                        "licence": "CC BY 4.0 (https://gwosc.org/data/)"}
        print(f"  {det}: {name} ({len(r.content)/1e6:.2f} MB)")
    src_path.write_text(json.dumps(sources, indent=1), encoding="utf-8")
    return sources


if __name__ == "__main__":
    print(json.dumps(fetch(), indent=1))
