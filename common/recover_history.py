"""Recover each piece's pre-sprite page source from the sprite-pass agent transcripts.

The sprite pass (workflow wf_fd9c0c8b-f66) agents Read their web/template.html (and README) before editing.
Those Read results are in the agent transcripts (cat -n format, possibly in chunks). This rebuilds the
earliest complete read of each file and writes entries/<slug>/history/<name>.pre_sprite.<ext>.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WFDIR = Path(r"C:\Users\Rahma\.claude\projects\C--Users-Rahma-OneDrive-Desktop-MOTH-QUANTUM\abc1849e-0bb4-4519-a365-7fdd300b83b2\subagents\workflows")
RUNS = ["wf_fd9c0c8b-f66", "wf_a5deba2e-584"]  # completed sprite pass first, then the interrupted one
TARGETS = ["web\\template.html", "web/template.html", "README.md"]
LINE = re.compile(r"^\s*(\d+)\t(.*)$")


def agent_ids(run):
    ids = {}
    for l in (WFDIR / run / "journal.jsonl").read_text(encoding="utf-8").splitlines():
        e = json.loads(l)
        if e.get("type") == "started" and e.get("label", "").startswith("sprites:"):
            ids.setdefault(e["label"].split(":", 1)[1], e["agentId"])
    return ids


def reads(path):
    """Yield (file_path, text) for every Read tool call and its result, in transcript order."""
    pending = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        try:
            ev = json.loads(raw)
        except json.JSONDecodeError:
            continue
        msg = ev.get("message") or {}
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        for c in content:
            if c.get("type") == "tool_use" and c.get("name") == "Read":
                pending[c["id"]] = c.get("input", {}).get("file_path", "")
            elif c.get("type") == "tool_result" and c.get("tool_use_id") in pending:
                fp = pending.pop(c["tool_use_id"])
                body = c.get("content")
                if isinstance(body, list):
                    body = "".join(x.get("text", "") for x in body if isinstance(x, dict))
                yield fp, body or ""
            elif c.get("type") in ("tool_use",) and c.get("name") in ("Edit", "Write"):
                fp = c.get("input", {}).get("file_path", "")
                yield fp, None  # an edit happened: later reads may be post-edit


def recover(slug, aid, run):
    f = WFDIR / run / f"agent-{aid}.jsonl"
    if not f.exists():
        return {}
    got = {}
    edited = set()
    for fp, body in reads(f):
        key = next((t for t in TARGETS if fp.replace("/", "\\").endswith(t.replace("/", "\\")) and slug in fp), None)
        if not key:
            continue
        name = "template.html" if "template" in key else "README.md"
        if body is None:
            edited.add(name)
            continue
        if name in edited:
            continue  # only trust reads made before the agent edited this file
        lines = got.setdefault(name, {})
        for ln in body.splitlines():
            m = LINE.match(ln)
            if m:
                lines.setdefault(int(m.group(1)), m.group(2))
    return got


def main():
    report = {}
    for run in RUNS:
        for slug, aid in agent_ids(run).items():
            for name, lines in recover(slug, aid, run).items():
                if not lines:
                    continue
                n = max(lines)
                missing = [i for i in range(1, n + 1) if i not in lines]
                key = (slug, name)
                prev = report.get(key)
                if prev and prev["missing"] <= len(missing):
                    continue
                out = ROOT / "entries" / slug / "history"
                out.mkdir(parents=True, exist_ok=True)
                stem, ext = name.rsplit(".", 1)
                text = "\n".join(lines.get(i, f"<!-- LINE {i} NOT RECOVERED -->") for i in range(1, n + 1)) + "\n"
                (out / f"{stem}.pre_sprite.{ext}").write_text(text, encoding="utf-8")
                report[key] = {"run": run, "lines": n, "missing": len(missing)}
    for (slug, name), r in sorted(report.items()):
        print(f"{slug:22s} {name:14s} lines={r['lines']:5d} missing={r['missing']:4d} ({r['run']})")
    slugs = {s for s, _ in report}
    print("no history:", sorted({p.name for p in (ROOT / "entries").iterdir() if p.is_dir()} - slugs))


if __name__ == "__main__":
    main()
