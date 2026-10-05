"""Probe the entanglement-shader 21-qubit budget via entanglement-shader-v0's synchronous validator.
An invalid config returns 422 at submission (free, nothing ledgered). Run once; results in out/probe_shader.txt."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError
a = Atlas(piece="06-tweezer", credit_cap=50)
for L, R in [(60, 60), (30, 40)]:
    try:
        a.run("entanglement-shader-v0", {"reflectance": 0.2, "absorption": 0.95, "layers": L, "incoming_rays": R}, timeout=600)
        print(L, R, "ACCEPTED (unexpected)")
    except AtlasError as e:
        print(L, R, str(e)[:600])
