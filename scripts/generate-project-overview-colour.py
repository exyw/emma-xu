"""Build compact colour previews from the supplied small ASCII and originals.

Run from the repository root with Pillow and Chrome installed:
    python3 scripts/generate-project-overview-colour.py

The generated WebP files are committed assets; the site does no image processing
at runtime. Chrome renders the supplied SVGs to antialiased glyph masks.
Connect3 keeps the violet logo glyphs and drops its doubled white/shadow ring.
"""

import json
import colorsys
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image, ImageChops, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/projects"
OUTPUT = ASSETS / "colour"
COLOUR_MAP_OUTPUT = ASSETS / "colour-map"
SCALE = 2
GAP = 16
FALLBACK = {
    "chip": (72, 66, 75),
    "wit": (63, 42, 91),
    "dk": (34, 34, 41),
    "cnn": (73, 65, 59),
    "connect3": (55, 41, 100),
}
TERMINAL_HUE = {
    "chip": 340 / 360,
    "wit": 270 / 360,
    "dk": 185 / 360,
    "cnn": 202 / 360,
    "connect3": 265 / 360,
}


def chrome_binary():
    for name in ("google-chrome", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            return found
    mac = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if mac.exists():
        return str(mac)
    raise RuntimeError("Chrome or Chromium is required to render the ASCII masks")


def projects():
    config = (ROOT / "projects-config.js").read_text()
    match = re.search(r"window\.projectConfig\s*=\s*(\{.*\});\s*$", config, re.S)
    if not match:
        raise ValueError("Could not read projects-config.js")
    return json.loads(match.group(1))["projects"]


def svg_size(path):
    view_box = ElementTree.parse(path).getroot().get("viewBox").split()
    return int(float(view_box[2])), int(float(view_box[3]))


def rendered_masks(items, directory):
    top = 0
    locations = {}
    tags = []
    for item in items:
        width, height = item["size"]
        tags.append(f'<img src="{(ASSETS / "ascii" / item["small"]).as_uri()}" '
                    f'style="position:absolute;left:0;top:{top}px;width:{width * SCALE}px;height:{height * SCALE}px">')
        locations[item["id"]] = (top, width * SCALE, height * SCALE)
        top += height * SCALE + GAP
    html = directory / "masks.html"
    html.write_text('<!doctype html><html><head><style>html,body{margin:0;background:white}</style>'
                    '</head><body>' + ''.join(tags) + '</body></html>')
    screenshot = directory / "masks.png"
    width = max(500, max(item["size"][0] for item in items) * SCALE + 20)
    height = top + 80
    result = subprocess.run([
        chrome_binary(), "--headless", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--hide-scrollbars",
        "--allow-file-access-from-files", "--force-device-scale-factor=1",
        f"--user-data-dir={directory / 'chrome-profile'}",
        f"--window-size={width},{height}", f"--screenshot={screenshot}", html.as_uri(),
    ], capture_output=True, text=True, timeout=30, check=False)
    if result.returncode or not screenshot.exists():
        raise RuntimeError(f"Chrome could not render ASCII masks: {result.stderr[-1000:]}")
    image = Image.open(screenshot).convert("RGB")
    if image.size != (width, height):
        raise RuntimeError("Chrome screenshot did not match the requested mask dimensions")
    return {
        key: ImageOps.invert(image.crop((0, y, w, y + h)).convert("L"))
        for key, (y, w, h) in locations.items()
    }


def colour_pixels(item, size):
    source = Image.open(ASSETS / "images" / item["original"]).convert("RGBA")
    visible = source.getchannel("A").getbbox()
    if not visible:
        raise ValueError(f"{item['original']} has no visible pixels")
    source = source.crop(visible).resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, FALLBACK[item["id"]] + (255,))
    canvas.alpha_composite(source)
    # Keep recognisable source hues, but give neutral and dark areas a saturated
    # phosphor ink. Limit brightness so the glyphs read on the warm background.
    pixels = []
    for red, green, blue, _ in canvas.getdata():
        luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
        hue, _, saturation = colorsys.rgb_to_hls(red / 255, green / 255, blue / 255)
        if saturation < 0.22:
            hue = TERMINAL_HUE[item["id"]]
        lightness = 0.24 + 0.20 * math.sqrt(luminance / 255)
        if item["id"] == "connect3":
            hue = TERMINAL_HUE["connect3"]
            lightness = max(0.31, lightness)
        channels = [round(value * 255) for value in colorsys.hls_to_rgb(hue, lightness, 0.9)]
        ink_luminance = sum(value * weight for value, weight in zip(channels, (0.2126, 0.7152, 0.0722)))
        factor = min(1, 110 / ink_luminance) if ink_luminance else 1
        pixels.append(tuple(round(value * factor) for value in channels))
    coloured = Image.new("RGB", size)
    coloured.putdata(pixels)
    return coloured


def connect3_primary_glyphs(item, mask):
    """Keep the violet logo glyphs, excluding its second white/shadow outline."""
    source = Image.open(ASSETS / "images" / item["original"]).convert("RGBA")
    source = source.crop(source.getchannel("A").getbbox()).resize(mask.size, Image.Resampling.LANCZOS)
    coverage = []
    for red, green, blue, alpha in source.getdata():
        violet = min(1, max(0, (blue - red - 8) / 20),
                     max(0, (blue - green - 8) / 20))
        coverage.append(round(alpha * violet))
    primary = Image.new("L", mask.size)
    primary.putdata(coverage)
    result = ImageChops.multiply(mask, primary)
    if not result.getbbox():
        raise ValueError("Connect3 original has no violet logo pixels to match its ASCII")
    return result


def main():
    items = projects()
    for item in items:
        item["size"] = svg_size(ASSETS / "ascii" / item["small"])
    OUTPUT.mkdir(exist_ok=True)
    COLOUR_MAP_OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="emma-project-colour-") as temporary:
        masks = rendered_masks(items, Path(temporary))
        for item in items:
            mask = masks[item["id"]]
            if item["id"] == "connect3":
                mask = connect3_primary_glyphs(item, mask)
            # Strengthen antialiased character strokes without adding a glow or
            # moving any glyph pixels; this keeps saturated ink visible at slot size.
            mask = mask.point(lambda alpha: round(255 * (alpha / 255) ** 0.72) if alpha else 0)
            colour = colour_pixels(item, mask.size)
            # The detail flip uses the same colours beneath its larger glyph mask.
            colour.save(COLOUR_MAP_OUTPUT / f"{item['id']}.webp",
                        "WEBP", quality=88, method=6)
            colour.putalpha(mask)
            destination = OUTPUT / f"{item['id']}.webp"
            colour.save(destination, "WEBP", lossless=True, method=6)
            print(f"{destination.relative_to(ROOT)}: {destination.stat().st_size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
