"""Minimal Moth Atlas API client with a content-addressed job cache.

    POST /engines/{engine}/process  {"params": {...}, "input_files": {slot: asset_id}} -> {"job_id"}
    GET  /jobs/{job_id}/status      -> {"status": queued|running|completed|failed}
    GET  /jobs/{job_id}/result      -> {"result": ..., "outputs": [{slot, filename, url, output_asset_id}]}
    POST /assets {filename, content_type, size_bytes} -> {"asset_id", "upload": {url, headers}}
      PUT upload.url, then POST /assets/{id}/complete

Every completed job is written to cache/<engine>/<hash>.json, so re-runs are free and the
whole project replays offline. Key comes from MOTH_API_KEY (env or .env in the project root).
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time
from pathlib import Path

import requests

BASE = "https://api.mothquantum.com/api/v1"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
        ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mid": "audio/midi", ".midi": "audio/midi",
        ".zip": "application/zip", ".json": "application/json", ".gif": "image/gif"}
RETRY = {429, 500, 502, 503, 504}


class AtlasError(RuntimeError):
    pass


def _key() -> str:
    k = os.environ.get("MOTH_API_KEY", "").strip()
    if k:
        return k
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("MOTH_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _atomic_write(path: Path, text: str):
    """Write via temp file + rename so parallel builds never see a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=path.suffix)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    for _ in range(20):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:  # Windows: target briefly open by another reader
            time.sleep(0.1)
    os.replace(tmp, path)


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, PermissionError):
        return default


def _hash(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()[:16]


class Atlas:
    """`piece` tags every new job in cache/ledger.jsonl; `credit_cap` refuses new submissions for
    that piece once its ledgered spend (credits_per_run x jobs) would exceed the cap.
    Both also read MOTH_PIECE / MOTH_CREDIT_CAP from the environment."""

    def __init__(self, log=print, piece=None, credit_cap=None):
        self.log = log
        self._k = None
        self.piece = piece or os.environ.get("MOTH_PIECE") or Path(sys.argv[0] or "repl").resolve().parent.name
        cap = credit_cap if credit_cap is not None else os.environ.get("MOTH_CREDIT_CAP")
        self.credit_cap = float(cap) if cap not in (None, "") else None
        self._credits = {}

    # -- credits ------------------------------------------------------------
    def credits_per_run(self, engine) -> float:
        if engine not in self._credits:
            self._credits[engine] = float(self.get(f"/engines/{engine}").get("credits_per_run") or 0)
        return self._credits[engine]

    def spent(self, piece=None) -> float:
        """Credits ledgered for a piece (default: this one)."""
        piece = piece or self.piece
        total = 0.0
        led = CACHE / "ledger.jsonl"
        if led.exists():
            for line in led.read_text(encoding="utf-8").splitlines():
                try:
                    e = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if e.get("piece") == piece:
                    total += float(e.get("credits", 0))
        return total

    # -- http ---------------------------------------------------------------
    def _headers(self):
        if self._k is None:
            self._k = _key()
        if not self._k:
            raise AtlasError("MOTH_API_KEY not set (put MOTH_API_KEY=... in .env at the project root)")
        return {"Authorization": f"Bearer {self._k}", "Accept": "application/json",
                "User-Agent": "moth-hack-phototaxis/0.1 (python-requests)"}

    def _req(self, method, path, ok=(), **kw):
        r = None
        for attempt in range(7):
            try:
                r = requests.request(method, BASE + path, headers=self._headers(), timeout=120, **kw)
            except (requests.ConnectionError, requests.Timeout):
                if attempt == 6:
                    raise
                time.sleep(min(2 ** attempt, 30))
                continue
            if r.status_code not in RETRY:
                break
            wait = r.headers.get("Retry-After", "")
            time.sleep(float(wait) if wait.replace(".", "", 1).isdigit() else min(2 ** attempt, 30))
        if r.status_code in ok:
            return r
        if r.status_code >= 400:
            raise AtlasError(f"{method} {path} -> {r.status_code}: {r.text[:1200]}")
        return r

    def get(self, path):
        return self._req("GET", path).json()

    def me(self):
        return self.get("/me")

    def engines(self):
        return self.get("/engines")

    # -- assets -------------------------------------------------------------
    def upload(self, path) -> str:
        path = Path(path)
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        idx_path = CACHE / "assets.json"
        idx = _read_json(idx_path, {})
        if digest in idx:
            return idx[digest]["asset_id"]
        ctype = MIME.get(path.suffix.lower())
        if not ctype:
            raise AtlasError(f"unsupported upload type {path.suffix}")
        a = self._req("POST", "/assets", json={"filename": path.name, "content_type": ctype,
                                                "size_bytes": len(data)}).json()
        up = a["upload"]
        r = requests.put(up["url"], data=data, headers=up.get("headers") or {}, timeout=300)
        if r.status_code >= 400:
            raise AtlasError(f"PUT {path.name} -> {r.status_code}: {r.text[:300]}")
        self._req("POST", f"/assets/{a['asset_id']}/complete")
        idx = _read_json(idx_path, {})  # re-read: another build may have added entries meanwhile
        idx[digest] = {"asset_id": a["asset_id"], "file": path.name}
        _atomic_write(idx_path, json.dumps(idx, indent=2))
        self.log(f"  uploaded {path.name} -> {a['asset_id']}")
        return a["asset_id"]

    # -- jobs ---------------------------------------------------------------
    def run(self, engine, params, files=None, timeout=1800):
        """Run a job (or return it from cache). `files` maps slot -> local path or 'job:<id>/<slot>'."""
        inputs = {}
        for slot, p in (files or {}).items():
            inputs[slot] = p if str(p).startswith(("job:", "asset:")) or not Path(p).exists() else self.upload(p)
        key = _hash({"e": engine, "p": params, "f": inputs})
        rec_path = CACHE / engine / f"{key}.json"
        if rec_path.exists():
            rec = _read_json(rec_path, None)
            if rec is not None:
                return rec
        pend = CACHE / "pending" / engine / f"{key}.json"
        if pend.exists():
            job_id = json.loads(pend.read_text(encoding="utf-8"))["job_id"]
            self.log(f"  {engine}: resuming {job_id}")
        else:
            if os.environ.get("MOTH_FREEZE") == "1":
                raise AtlasError(f"MOTH_FREEZE=1: refusing to submit a new {engine} job (not in cache)")
            cost = self.credits_per_run(engine)
            if self.credit_cap is not None and self.spent() + cost > self.credit_cap:
                raise AtlasError(f"credit cap reached for {self.piece}: spent {self.spent():g} of "
                                 f"{self.credit_cap:g}, next {engine} job costs {cost:g}")
            body = {"params": params}
            if inputs:
                body["input_files"] = inputs
            job_id = self._req("POST", f"/engines/{engine}/process", json=body).json()["job_id"]
            _atomic_write(pend, json.dumps({"job_id": job_id}))
            with open(CACHE / "ledger.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps({"piece": self.piece, "engine": engine, "job_id": job_id,
                                    "credits": cost, "key": key, "t": round(time.time())}) + "\n")
            self.log(f"  {engine}: submitted {job_id}")
        t0, delay = time.time(), 2.0
        while True:
            st = self.get(f"/jobs/{job_id}/status")
            s = st.get("status")
            if s in ("completed", "succeeded", "success"):
                break
            if s in ("failed", "cancelled", "canceled"):
                pend.unlink(missing_ok=True)
                raise AtlasError(f"{engine} {job_id} {s}: {json.dumps(st)[:1200]}")
            if time.time() - t0 > timeout:
                raise AtlasError(f"{engine} {job_id} still {s} after {timeout}s (re-run to resume)")
            time.sleep(delay)
            delay = min(delay * 1.3, 15)
        for _ in range(15):
            r = self._req("GET", f"/jobs/{job_id}/result", ok=(409,))
            if r.status_code != 409:
                break
            time.sleep(2)
        rec = {"engine": engine, "params": params, "input_files": inputs, "job_id": job_id,
               "seconds": round(time.time() - t0, 1), "response": r.json()}
        _atomic_write(rec_path, json.dumps(rec, indent=2))
        pend.unlink(missing_ok=True)
        self.log(f"  {engine}: done {job_id[:8]} in {rec['seconds']}s")
        return rec

    def outputs(self, rec, dest=None) -> dict:
        """Download a job's output files. Returns {slot: Path}."""
        dest = Path(dest or CACHE / "files" / rec["engine"])
        out = {}
        for o in (rec["response"] or {}).get("outputs") or []:
            p = dest / f"{rec['job_id'][:8]}_{o['slot']}_{o.get('filename') or o['slot']}"
            if not p.exists():
                r = requests.get(o["url"], timeout=300)
                if r.status_code in (403, 404, 410):
                    dl = self.get(f"/assets/{o['output_asset_id']}/download")
                    r = requests.get(dl.get("download_url") or dl["url"], timeout=300)
                r.raise_for_status()
                dest.mkdir(parents=True, exist_ok=True)
                p.write_bytes(r.content)
            out[o["slot"]] = p
        return out


if __name__ == "__main__":
    a = Atlas()
    print(json.dumps(a.me(), indent=2)[:800])
    eng = a.engines()
    items = eng.get("engines", eng) if isinstance(eng, dict) else eng
    print([e.get("id") or e.get("engine_id") or e.get("name") for e in items][:60])
