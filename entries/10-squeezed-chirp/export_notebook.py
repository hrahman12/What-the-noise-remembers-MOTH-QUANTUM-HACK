"""Export the executed notebook to web/notebook.html: a static, script-free, pure-ASCII reading view
that the page (LIGO Night Shift and its data room) links to. Every <script> is removed (MathJax, require.js and
the unpinned ipywidgets loader are not needed to read it); each widget is replaced by a short note. The reading
view takes the set's paper-and-ink look (THEME, below: Jupyter's own CSS variables re-pointed at the brand
tokens); the matplotlib figures inside are the notebook's executed outputs and keep their dark style.
"""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
NOTE = ('<div class="widget-note" style="border:1px dashed #A1A4CE;padding:.6rem .8rem;'
        'margin:.4rem 0;font:13px/1.4 monospace;color:#545BA9">ipywidgets control: it needs a running kernel. '
        'Open squeezed_chirp.ipynb in Jupyter to use it; the static figures above show the same data.</div>')
BANNER = ('<div style="font:13px/1.5 ui-monospace,Consolas,monospace;letter-spacing:.02em;padding:.8rem 1rem;'
          'background:#FBFAF9;color:#19238E;border-bottom:1px solid #19238E">'
          '<a href="index.html" style="color:#19238E;font-weight:600">&larr; Back to LIGO Night Shift (the game and the data room)</a> &middot; '
          'read-only view of <code>squeezed_chirp.ipynb</code>, executed top to bottom with MOTH_FREEZE=1 '
          '(all 6 Atlas jobs replayed from cache). The figures are the notebook\'s own matplotlib outputs in its dark style; '
          'the page draws the same data live in paper and ink.</div>')
# the set's paper-and-ink look for the reading view: Jupyter's CSS variables re-pointed at the brand tokens
THEME = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&amp;'
         'family=IBM+Plex+Mono:wght@400;500&amp;display=swap"><style>'
         ':root,body{--jp-layout-color0:#FBFAF9;--jp-layout-color1:#FBFAF9;--jp-layout-color2:#F0F0F4;'
         '--jp-content-font-color0:#19238E;--jp-content-font-color1:#19238E;--jp-content-font-color2:#545BA9;'
         '--jp-content-font-color3:#A1A4CE;--jp-ui-font-color0:#19238E;--jp-ui-font-color1:#19238E;'
         '--jp-ui-font-color2:#545BA9;--jp-ui-font-color3:#A1A4CE;--jp-border-color0:#D3D3E6;--jp-border-color1:#D3D3E6;'
         '--jp-border-color2:#D3D3E6;--jp-cell-editor-background:#FFFFFF;--jp-cell-editor-border-color:#D3D3E6;'
         '--jp-rendermime-error-background:#FBFAF9;--jp-content-link-color:#194BBA;'
         '--jp-content-font-family:Geist,"Helvetica Neue",Arial,sans-serif;--jp-ui-font-family:Geist,"Helvetica Neue",Arial,sans-serif;'
         '--jp-code-font-family:"IBM Plex Mono",ui-monospace,Consolas,monospace;--jp-cell-prompt-not-active-font-color:#A1A4CE}'
         'html,body{background:#FBFAF9;color:#19238E}'
         '.jp-RenderedHTMLCommon h1,.jp-RenderedHTMLCommon h2,.jp-RenderedHTMLCommon h3{font-weight:400;letter-spacing:-.015em;color:#19238E}'
         '.jp-RenderedHTMLCommon h2{border-top:1px solid #19238E;padding-top:.6em}'
         '.jp-RenderedHTMLCommon blockquote{border-left:3px solid #19238E;background:rgba(25,35,142,.05);color:#19238E}'
         '.jp-RenderedHTMLCommon th{background:#F0F0F4}'
         '.jp-OutputArea-output pre{color:#19238E}'
         '</style>')


def ascii_page(h: str) -> str:
    def css(m):
        return "".join(c if ord(c) < 128 else f"\\{ord(c):06x}" for c in m.group(0))
    parts = re.split(r"(<style[^>]*>.*?</style>)", h, flags=re.S)
    return "".join(css(re.match(r".*", p, re.S)) if p.startswith("<style") else
                   p.encode("ascii", "xmlcharrefreplace").decode("ascii") for p in parts)


def main():
    tmp = HERE / "out"
    subprocess.run([sys.executable, "-m", "jupyter", "nbconvert", "--to", "html", str(HERE / "squeezed_chirp.ipynb"),
                    "--output-dir", str(tmp), "--output", "notebook_export"], check=True)
    h = (tmp / "notebook_export.html").read_text(encoding="utf-8")
    h = re.sub(r'<script type="application/vnd\.jupyter\.widget-view\+json">.*?</script>', NOTE, h, flags=re.S)
    h = re.sub(r"<script\b[^>]*>.*?</script>", "", h, flags=re.S)
    h = re.sub(r"<title>.*?</title>", "<title>Squeezed Chirp notebook</title>", h, count=1, flags=re.S)
    # nbconvert gives each widget output a fresh random uuid4 id: number them instead, so the export is
    # reproducible and no stray UUID can be mistaken for an Atlas job ID
    n = iter(range(1, 1000))
    h = re.sub(r'(class="jupyter-widgets jp-OutputArea-output" id=")[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"',
               lambda m: f'{m.group(1)}widget-output-{next(n)}"', h)
    h = h.replace("</head>", THEME + "</head>", 1)
    h = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + BANNER, h, count=1)
    assert "<script" not in h and THEME in h
    out = ascii_page(h)
    (WEB / "notebook.html").write_text(out, encoding="ascii")
    (tmp / "notebook_export.html").unlink()
    hosts = sorted(set(re.findall(r"(?:src|href)=\"(https?://[^\"/]+)", out)))
    print(f"web/notebook.html written ({len(out)/1e6:.2f} MB); linked hosts: {hosts}")


if __name__ == "__main__":
    main()
