"""Download the WMAP 9-year ILC map from NASA LAMBDA (classical step, no quantum).

Source page: https://lambda.gsfc.nasa.gov/product/wmap/dr5/ilc_map_info.html
Download script published by LAMBDA: https://lambda.gsfc.nasa.gov/product/wmap/dr5/ilc_map_curl.sh
Usage terms (verified 2026-10-04): https://lambda.gsfc.nasa.gov/contact/ "Mission and Use
Acknowledgement Statement": no cost to use; acknowledgement requested (see CREDITS.md).
The file is HEALPix, NESTED, Nside 512, Galactic coordinates, smoothed to 1 degree.
"""
import hashlib
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
URL = "https://lambda.gsfc.nasa.gov/data/map/dr5/dfp/ilc/wmap_ilc_9yr_v5.fits"
DEST = HERE / "data" / "wmap_ilc_9yr_v5.fits"


def main():
    DEST.parent.mkdir(exist_ok=True)
    if not DEST.exists():
        r = requests.get(URL, timeout=600)
        r.raise_for_status()
        DEST.write_bytes(r.content)
    data = DEST.read_bytes()
    print(f"{DEST.name}: {len(data):,} bytes, sha256 {hashlib.sha256(data).hexdigest()[:16]}")


if __name__ == "__main__":
    main()
