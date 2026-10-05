"""Free payload-limit probe (no job is ever created, no credit spent).

Posts an n x n grid of zeros to blur-core-v1 with an INVALID style ("z"), so the API answers 422 (schema)
if the body was accepted, or 413 if the body is over the request limit. Usage: python probe_payload.py 4 1024 4096
Results we saw: 4 -> 422; 1024 (2.1 MB) -> 413 "limit=1048576 bytes"; 4096 (33.6 MB) -> 413.
"""
import sys, json, time, requests
sys.path.insert(0, r"C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM")
from atlas.client import Atlas, BASE
a = Atlas(piece="17-quantum-lenia", credit_cap=8)
h = a._headers(); h["Content-Type"] = "application/json"
def probe(n, note):
    row = "[" + ",".join(["0"] * n) + "]"
    vals = "[" + ",".join([row] * n) + "]"
    body = '{"params":{"values":' + vals + ',"style":"z","max_qubits":24}}'
    t0 = time.time()
    try:
        r = requests.post(BASE + "/engines/blur-core-v1/process", data=body.encode(), headers=h, timeout=300)
        print(n, note, f"{len(body)/1e6:.1f} MB", r.status_code, r.text[:300].replace("\n"," "), f"{time.time()-t0:.1f}s", flush=True)
    except Exception as e:
        print(n, note, f"{len(body)/1e6:.1f} MB", "EXC", repr(e)[:200], flush=True)
for n in map(int, sys.argv[1:]):
    probe(n, "")
