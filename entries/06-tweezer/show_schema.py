import json, sys
def typ(v):
    if "anyOf" in v: return "|".join(typ(x) for x in v["anyOf"])
    t = v.get("type", "?")
    if "enum" in v: t += str(v["enum"])
    return t
for n in sys.argv[1:]:
    s = json.load(open(n + ".json", encoding="utf-8"))
    print("=" * 30, n, "credits", s.get("credits_per_run"), "ver", s.get("version"), "exec", s.get("execution_mode"))
    print(s.get("description_md") or s.get("description"))
    ps = s.get("params_schema") or {}
    print("--- params (required:", ps.get("required"), ")")
    for k, v in (ps.get("properties") or {}).items():
        lim = {x: v[x] for x in ("minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems") if x in v}
        print(f"  {k}: {typ(v)} default={json.dumps(v.get('default'))[:80]} {lim} | {(v.get('description') or '')[:400]}")
    print("--- input_files", json.dumps(s.get("input_files")))
    print("--- output_files", json.dumps(s.get("output_files")))
