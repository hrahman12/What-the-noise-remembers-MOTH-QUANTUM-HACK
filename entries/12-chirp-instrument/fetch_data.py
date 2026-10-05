"""Download the real LIGO strain around GW150914 and GW170817 from GWOSC. CLASSICAL.

32 s of H1 and L1 strain at 4096 Hz per event (HDF5, CC BY 4.0, https://gwosc.org/acknowledgement/),
plus the event's catalogue parameters (GPS time, source-frame chirp mass, redshift) from the GWOSC
event API. Files land in data/; re-runs skip anything already downloaded.
"""
from __future__ import annotations

import json
from pathlib import Path

import requests
from gwosc.api import fetch_event_json
from gwosc.datasets import event_gps
from gwosc.locate import get_event_urls

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
EVENTS = ["GW150914", "GW170817"]
DETECTORS = ["H1", "L1"]


def main():
    DATA.mkdir(exist_ok=True)
    meta = {}
    for ev in EVENTS:
        meta[ev] = {"gps": event_gps(ev), "files": {}}
        js = fetch_event_json(ev)
        name, rec = next(iter(js["events"].items()))
        meta[ev]["catalog_id"] = name
        meta[ev]["catalog"] = rec.get("catalog.shortName")
        for k in ("GPS", "chirp_mass_source", "chirp_mass_source_lower", "chirp_mass_source_upper",
                  "redshift", "mass_1_source", "mass_2_source", "luminosity_distance", "network_matched_filter_snr"):
            meta[ev][k] = rec.get(k)
        meta[ev]["event_url"] = f"https://gwosc.org/eventapi/html/{rec.get('catalog.shortName')}/{ev}/"
        for det in DETECTORS:
            urls = [u for u in get_event_urls(ev, duration=32, sample_rate=4096, detector=det) if u.endswith(".hdf5")]
            url = urls[0]
            dest = DATA / url.rsplit("/", 1)[1]
            if not dest.exists():
                r = requests.get(url, timeout=300)
                r.raise_for_status()
                dest.write_bytes(r.content)
                print(f"  downloaded {dest.name} ({len(r.content) / 1e6:.1f} MB)")
            meta[ev]["files"][det] = {"file": dest.name, "url": url}
    (DATA / "events.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
