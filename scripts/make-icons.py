"""Generate all raster app icons for Lowstate from the pixel-mark design.

The mark is pure squares, so we draw it directly with Pillow (matching
assets/icon.svg) instead of rasterising the SVG. Run: python3 scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ICONSET = ASSETS / "icon.iconset"
ICONSET.mkdir(exist_ok=True)

VIEWBOX = 240
BG = "#1f1e1c"
CREAM = "#F2E8CF"
CYAN = "#00B8D4"
CORNER = 52  # rounded-rect radius in viewBox units

CREAM_RECTS = [
    (100, 98, 20, 20), (100, 120, 20, 20), (100, 142, 20, 20), (100, 164, 20, 20),
    (122, 80, 18, 18), (100, 74, 16, 16), (124, 58, 14, 14),
    (103, 50, 12, 12), (126, 38, 9, 9), (108, 30, 8, 8),
]
CYAN_RECT = (122, 164, 20, 20)


def render(size, supersample=4):
    big = size * supersample
    scale = big / VIEWBOX
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, big - 1, big - 1], radius=round(CORNER * scale), fill=BG)
    for x, y, w, h in CREAM_RECTS:
        d.rectangle([x * scale, y * scale, (x + w) * scale, (y + h) * scale], fill=CREAM)
    x, y, w, h = CYAN_RECT
    d.rectangle([x * scale, y * scale, (x + w) * scale, (y + h) * scale], fill=CYAN)
    return img.resize((size, size), Image.LANCZOS)


master = render(1024)
master.save(ASSETS / "icon-1024.png")
master.resize((512, 512), Image.LANCZOS).save(ASSETS / "icon-512.png")

# Brand icon is fixed — the desktop dock swaps to icon-<cover>.png, so keep them
# all identical (Lowstate mark regardless of notebook cover colour).
for name in ("rose", "blue", "green", "yellow", "purple"):
    master.save(ASSETS / f"icon-{name}.png")

for s in (16, 32, 128, 256, 512):
    master.resize((s, s), Image.LANCZOS).save(ICONSET / f"icon_{s}x{s}.png")
    master.resize((s * 2, s * 2), Image.LANCZOS).save(ICONSET / f"icon_{s}x{s}@2x.png")

master.save(ASSETS / "icon.ico", format="ICO",
            sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
master.save(ASSETS / "icon.icns", format="ICNS",
            sizes=[(16, 16), (32, 32), (128, 128), (256, 256), (512, 512), (1024, 1024)])

print("Icons generated.")
