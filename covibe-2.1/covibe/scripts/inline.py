#!/usr/bin/env python3
"""Inline the covibe comment layer into a page.

Usage: python3 scripts/inline.py page.html [out.html]

The page must contain the markers /*covibe:css*/ and /*covibe:js*/,
for example <style>/*covibe:css*/</style> and <script>/*covibe:js*/</script>.
If the markers were already replaced, the old inlined block is replaced again.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent / "assets"
CSS = (HERE / "comment-layer.css").read_text()
JS = (HERE / "comment-layer.js").read_text()


def inline(html: str) -> str:
    css_block = "/*covibe:css*/\n" + CSS + "\n/*covibe:css:end*/"
    js_block = "/*covibe:js*/\n" + JS + "\n/*covibe:js:end*/"
    html, n1 = re.subn(r"/\*covibe:css\*/(?:.*?/\*covibe:css:end\*/)?", lambda m: css_block, html, count=1, flags=re.S)
    html, n2 = re.subn(r"/\*covibe:js\*/(?:.*?/\*covibe:js:end\*/)?", lambda m: js_block, html, count=1, flags=re.S)
    if not (n1 and n2):
        sys.exit("inline.py: markers /*covibe:css*/ and /*covibe:js*/ not found")
    return html


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else src
    out.write_text(inline(src.read_text()))
    print(f"inlined comment layer into {out}")
