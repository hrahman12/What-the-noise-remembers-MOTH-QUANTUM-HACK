"""Download the source dataset (CLASSICAL, no Atlas).

Zhang et al. 2023 (Nature) whole-mouse-brain MERFISH, animal 4 (3 sagittal sections, 1120 genes),
as curated by CZ CELLxGENE Discover. Licence: CC BY 4.0 (see CREDITS.md). Public HTTPS link,
no account or form. ~133 MB, saved to data/WB_MERFISH_animal4_sagittal.h5ad.
"""
import hashlib
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
URL = "https://datasets.cellxgene.cziscience.com/4b5c682f-4b5d-4dcb-81c1-606fef2b601e.h5ad"
DEST = HERE / "data" / "WB_MERFISH_animal4_sagittal.h5ad"
SIZE = 133343067


def main():
    DEST.parent.mkdir(exist_ok=True)
    if DEST.exists() and DEST.stat().st_size == SIZE:
        print(f"{DEST.name} already present")
        return
    tmp = DEST.with_suffix(".part")
    with requests.get(URL, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    tmp.replace(DEST)
    h = hashlib.sha256(DEST.read_bytes()).hexdigest()
    print(f"{DEST.name}: {DEST.stat().st_size} bytes, sha256 {h}")


if __name__ == "__main__":
    main()
