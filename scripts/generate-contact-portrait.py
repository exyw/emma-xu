"""Rasterize a supplied Contact ASCII SVG to a transparent lossless WebP.

Usage: python3 scripts/generate-contact-portrait.py assets/contact/emma_mobile.svg
Requires Pillow and Chrome. The output sits beside the SVG with a .webp suffix.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image, ImageOps


def chrome_binary():
    for name in ("google-chrome", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            return found
    mac = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if mac.exists():
        return str(mac)
    raise RuntimeError("Chrome or Chromium is required to render the Contact portrait")


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/generate-contact-portrait.py <source.svg>")
    source = Path(sys.argv[1]).resolve()
    if source.suffix.lower() != ".svg" or not source.is_file():
        raise SystemExit("Provide an existing SVG file")
    view_box = ElementTree.parse(source).getroot().get("viewBox")
    if not view_box:
        raise RuntimeError("Contact SVG needs a viewBox")
    _, _, width, height = map(float, view_box.split())
    width, height = round(width), round(height)

    with tempfile.TemporaryDirectory(prefix="contact-portrait-") as temp:
        directory = Path(temp)
        html = directory / "portrait.html"
        html.write_text(
            '<!doctype html><html><head><style>html,body{margin:0;background:white}'
            'img{display:block}</style></head><body>'
            f'<img src="{source.as_uri()}" width="{width}" height="{height}">'
            '</body></html>'
        )
        screenshot = directory / "portrait.png"
        result = subprocess.run([
            chrome_binary(), "--headless", "--disable-gpu", "--no-first-run",
            "--no-default-browser-check", "--hide-scrollbars",
            "--allow-file-access-from-files", "--force-device-scale-factor=1",
            f"--user-data-dir={directory / 'chrome-profile'}",
            f"--window-size={width},{height}", f"--screenshot={screenshot}",
            html.as_uri(),
        ], capture_output=True, text=True, timeout=120, check=False)
        if result.returncode or not screenshot.exists():
            raise RuntimeError(
                f"Chrome could not render the SVG (exit {result.returncode}, "
                f"screenshot exists: {screenshot.exists()}): {result.stderr[-1000:]}"
            )
        rendered = Image.open(screenshot).convert("RGB")
        if rendered.size != (width, height):
            raise RuntimeError("Chrome screenshot dimensions did not match the SVG viewBox")
        portrait = Image.new("RGBA", rendered.size, (0, 0, 0, 0))
        portrait.putalpha(ImageOps.invert(rendered.convert("L")))
        destination = source.with_suffix(".webp")
        portrait.save(destination, "WEBP", lossless=True, method=6)
        print(destination)


if __name__ == "__main__":
    main()
