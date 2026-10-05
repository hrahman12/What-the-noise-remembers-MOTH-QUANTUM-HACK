"""Where do the 60 neurons keep their synapses? (classical, offline, no Atlas)

Reads traced-roi-connections.csv straight out of the cached hemibrain v1.2 tarball (it is never
extracted to disk) and, for every neuron in data/circuits.json, sums the synapses it makes (as the
presynaptic cell) and receives (as the postsynaptic cell) in each primary ROI (brain region), over ALL of
its partners in the hemibrain, not only the 20 in its circuit. It also records, for every modelled bond,
which ROIs hold the synapses between the two cells.

Writes data/neuron_rois.json, which build_web.py inlines into the page. The page uses it to place each
station in the brain region that holds most of its synapses and to list the full breakdown.
"""
import csv
import io
import json
import tarfile
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
TAR = HERE / "data" / "raw" / "exported-traced-adjacencies-v1.2.tar.gz"
MEMBER = "exported-traced-adjacencies-v1.2/traced-roi-connections.csv"


def main():
    circ = json.loads((HERE / "data" / "circuits.json").read_text(encoding="utf-8"))
    ids = {n["bodyId"] for c in circ["circuits"] for n in c["neurons"]}
    pairs = {}
    for c in circ["circuits"]:
        for e in c["edges"]:
            a, b = c["neurons"][e["i"]]["bodyId"], c["neurons"][e["j"]]["bodyId"]
            pairs[(a, b)] = pairs[(b, a)] = (c["id"], e["i"], e["j"])
    out_roi = defaultdict(lambda: defaultdict(int))   # bodyId -> roi -> synapses made (pre)
    in_roi = defaultdict(lambda: defaultdict(int))    # bodyId -> roi -> synapses received (post)
    bond_roi = defaultdict(lambda: defaultdict(int))  # (circuit, i, j) -> roi -> synapses both ways
    rois = set()
    rows = 0
    with tarfile.open(TAR, "r:gz") as tf:
        fh = io.TextIOWrapper(tf.extractfile(MEMBER), encoding="utf-8")
        rd = csv.reader(fh)
        head = next(rd)
        assert head[:4] == ["bodyId_pre", "bodyId_post", "roi", "weight"], head
        for pre, post, roi, w in rd:
            rows += 1
            rois.add(roi)
            pre, post, w = int(pre), int(post), int(w)
            if pre in ids:
                out_roi[pre][roi] += w
            if post in ids:
                in_roi[post][roi] += w
            k = pairs.get((pre, post))
            if k:
                bond_roi[k][roi] += w
    res = {"source": "hemibrain v1.2 traced-roi-connections.csv (primary ROIs only), read from the cached tarball",
           "rows_scanned": rows, "primary_rois": sorted(rois), "neurons": {}, "bonds": {}}
    for b in sorted(ids):
        o, i = out_roi[b], in_roi[b]
        tot = {r: o.get(r, 0) + i.get(r, 0) for r in set(o) | set(i)}
        res["neurons"][str(b)] = {
            "out": dict(sorted(o.items(), key=lambda kv: -kv[1])),
            "in": dict(sorted(i.items(), key=lambda kv: -kv[1])),
            "total": dict(sorted(tot.items(), key=lambda kv: -kv[1])),
        }
    for (cid, i, j), d in bond_roi.items():
        if i < j:
            res["bonds"][f"{cid}:{i}:{j}"] = dict(sorted(d.items(), key=lambda kv: -kv[1]))
    (HERE / "data" / "neuron_rois.json").write_text(json.dumps(res, indent=0) + "\n", encoding="utf-8")
    print(f"scanned {rows:,} rows, {len(rois)} primary ROIs; wrote data/neuron_rois.json")
    for c in circ["circuits"]:
        print(c["id"])
        for n in c["neurons"]:
            t = res["neurons"][str(n["bodyId"])]["total"]
            s = sum(t.values()) or 1
            top = ", ".join(f"{r} {100 * v / s:.0f}%" for r, v in list(t.items())[:4])
            print(f"  {n['i']:2d} {n['instance']:34s} {s:6d}  {top}")


if __name__ == "__main__":
    main()
