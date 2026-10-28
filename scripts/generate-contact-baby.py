"""Rasterize the supplied baby ASCII SVG to a transparent lossless WebP.

Requires Pillow and Cairo. Run: python3 scripts/generate-contact-baby.py
"""

import ctypes
import re
import tempfile
from ctypes.util import find_library
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/contact/baby_contact (3).svg"
OUTPUT = ROOT / "assets/contact/baby_contact.webp"
SCALE = 1
COMMANDS = set("MCHLVZ")
TOKEN = re.compile(r"[MCHLVZ]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def cairo_library():
    candidates = [
        find_library("cairo"),
        "/opt/homebrew/lib/libcairo.2.dylib",
        "/usr/local/lib/libcairo.2.dylib",
        "libcairo.so.2",
    ]
    for candidate in filter(None, candidates):
        try:
            return ctypes.CDLL(candidate)
        except OSError:
            pass
    raise RuntimeError("Cairo is required to rasterize the baby illustration")


def main():
    root = ElementTree.parse(SOURCE).getroot()
    width, height = (round(float(value)) for value in root.get("viewBox").split()[2:])
    paths = [element for element in root if element.tag.rsplit("}", 1)[-1] == "path"]
    if len(paths) != 1 or paths[0].get("fill") != "black":
        raise ValueError("Expected the supplied single black SVG path")
    data = paths[0].get("d")
    unsupported = set(re.findall(r"[A-Za-z]", data)) - COMMANDS - {"e", "E"}
    if unsupported:
        raise ValueError(f"Unsupported SVG path commands: {sorted(unsupported)}")
    tokens = iter(TOKEN.finditer(data))

    cairo = cairo_library()
    pointer = ctypes.c_void_p
    number = ctypes.c_double
    signatures = {
        "cairo_image_surface_create": ([ctypes.c_int, ctypes.c_int, ctypes.c_int], pointer),
        "cairo_create": ([pointer], pointer),
        "cairo_scale": ([pointer, number, number], None),
        "cairo_move_to": ([pointer, number, number], None),
        "cairo_line_to": ([pointer, number, number], None),
        "cairo_curve_to": ([pointer, number, number, number, number, number, number], None),
        "cairo_close_path": ([pointer], None),
        "cairo_set_source_rgba": ([pointer, number, number, number, number], None),
        "cairo_fill": ([pointer], None),
        "cairo_surface_write_to_png": ([pointer, ctypes.c_char_p], ctypes.c_int),
        "cairo_destroy": ([pointer], None),
        "cairo_surface_destroy": ([pointer], None),
    }
    for name, (arguments, result) in signatures.items():
        function = getattr(cairo, name)
        function.argtypes = arguments
        function.restype = result

    surface = cairo.cairo_image_surface_create(0, width * SCALE, height * SCALE)
    context = cairo.cairo_create(surface)
    try:
        cairo.cairo_scale(context, SCALE, SCALE)
        command = None
        x = y = start_x = start_y = 0.0
        for match in tokens:
            token = match.group()
            if token in COMMANDS:
                command = token
                if command == "Z":
                    cairo.cairo_close_path(context)
                    x, y = start_x, start_y
                    command = None
                continue
            else:
                first = float(token)
            if command == "M":
                x, y = first, float(next(tokens).group())
                cairo.cairo_move_to(context, x, y)
                start_x, start_y = x, y
                command = "L"
            elif command == "L":
                x, y = first, float(next(tokens).group())
                cairo.cairo_line_to(context, x, y)
            elif command == "H":
                x = first
                cairo.cairo_line_to(context, x, y)
            elif command == "V":
                y = first
                cairo.cairo_line_to(context, x, y)
            elif command == "C":
                values = [first] + [float(next(tokens).group()) for _ in range(5)]
                cairo.cairo_curve_to(context, *values)
                x, y = values[-2:]
            else:
                raise ValueError(f"Unsupported SVG path command: {command}")

        cairo.cairo_set_source_rgba(context, 0, 0, 0, 1)
        cairo.cairo_fill(context)
        with tempfile.TemporaryDirectory(prefix="contact-baby-") as directory:
            png = Path(directory) / "baby.png"
            if cairo.cairo_surface_write_to_png(surface, str(png).encode()) != 0:
                raise RuntimeError("Cairo PNG export failed")
            image = Image.open(png).convert("RGBA")
            # Fine ASCII strokes become faint when the raster is shown at page size.
            image.putalpha(image.getchannel("A").point(
                [min(255, value * 3) for value in range(256)]
            ))
            image.save(OUTPUT, "WEBP", lossless=True, method=6)
    finally:
        cairo.cairo_destroy(context)
        cairo.cairo_surface_destroy(surface)
    print(OUTPUT)


if __name__ == "__main__":
    main()
