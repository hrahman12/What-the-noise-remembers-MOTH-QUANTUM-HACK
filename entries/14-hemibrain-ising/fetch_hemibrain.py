"""Download the openly published hemibrain v1.2 traced-adjacency export (no account, no token).

Source page (licence "Hemibrain is licensed under CC-BY", linking CC BY 4.0):
    https://www.janelia.org/project-team/flyem/hemibrain
The page links the tarball as storage.cloud.google.com/hemibrain/v1.2/...; the same public object is
served without sign-in from storage.googleapis.com. MD5 is checked against the bucket's published hash.
Only README, traced-neurons.csv and traced-total-connections.csv are extracted.
"""
import hashlib
import tarfile
from pathlib import Path

import requests

URL = "https://storage.googleapis.com/hemibrain/v1.2/exported-traced-adjacencies-v1.2.tar.gz"
MD5 = "ec1e076d15442f368fa5978b00f4a61c"
RAW = Path(__file__).resolve().parent / "data" / "raw"
TAR = RAW / "exported-traced-adjacencies-v1.2.tar.gz"
NEED = ["README", "traced-neurons.csv", "traced-total-connections.csv"]


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    out = RAW / "exported-traced-adjacencies-v1.2"
    if all((out / n).exists() for n in NEED):
        print("hemibrain export already extracted")
        return
    if not TAR.exists():
        print(f"downloading {URL} (45.9 MB)")
        with requests.get(URL, stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(TAR, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
    md5 = hashlib.md5(TAR.read_bytes()).hexdigest()
    if md5 != MD5:
        raise SystemExit(f"MD5 mismatch: {md5} != {MD5}")
    with tarfile.open(TAR) as t:
        members = [m for m in t.getmembers() if Path(m.name).name in NEED]
        t.extractall(RAW, members=members, filter="data")
    print("extracted", [m.name for m in members])


if __name__ == "__main__":
    main()
