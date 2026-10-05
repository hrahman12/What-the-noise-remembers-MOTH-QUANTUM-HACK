"""Make a page pure ASCII so dashes, dots and symbols survive any server or charset.

Non-ASCII characters become CSS escapes inside <style>, \\u escapes inside <script>,
and numeric entities everywhere else. The rendered page is unchanged.
"""
import re


def _css(s):
    return "".join(c if ord(c) < 128 else f"\\{ord(c):06x}" for c in s)


def _js(s):
    out = []
    for c in s:
        o = ord(c)
        if o < 128:
            out.append(c)
        elif o <= 0xFFFF:
            out.append(f"\\u{o:04x}")
        else:  # astral plane: surrogate pair
            o -= 0x10000
            out.append(f"\\u{0xD800 + (o >> 10):04x}\\u{0xDC00 + (o & 0x3FF):04x}")
    return "".join(out)


def to_ascii(html: str) -> str:
    parts = re.split(r"(<style>.*?</style>|<script>.*?</script>)", html, flags=re.S)
    out = []
    for p in parts:
        if p.startswith("<style>"):
            out.append(_css(p))
        elif p.startswith("<script>"):
            out.append(_js(p))
        else:
            out.append(p.encode("ascii", "xmlcharrefreplace").decode("ascii"))
    return "".join(out)
