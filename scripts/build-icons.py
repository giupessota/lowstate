from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "icon-1024.png"
ICONSET = ASSETS / "icon.iconset"

ICONSET.mkdir(exist_ok=True)
image = Image.open(SOURCE).convert("RGBA")

red, green, blue, _alpha = image.split()
warm_mask = ImageChops.darker(
    ImageChops.subtract(red, green),
    ImageChops.subtract(red, blue),
).point(lambda value: 255 if value > 7 else 0)
warm_mask = warm_mask.filter(ImageFilter.GaussianBlur(2))
gray = ImageOps.grayscale(image)
palettes = {
    "rose": ("#704b4a", "#f3d8d3"),
    "blue": ("#426b89", "#d9e8f2"),
    "green": ("#4f7555", "#dcebdd"),
    "yellow": ("#896b2e", "#f5e8bc"),
    "purple": ("#64517e", "#e6dff0"),
}
for name, (dark, light) in palettes.items():
    if name == "rose":
        variant = image
    else:
        colored = ImageOps.colorize(gray, dark, light).convert("RGBA")
        variant = Image.composite(colored, image, warm_mask)
    variant.save(ASSETS / f"icon-{name}.png")

for size in (16, 32, 128, 256, 512):
    image.resize((size, size), Image.Resampling.LANCZOS).save(
        ICONSET / f"icon_{size}x{size}.png"
    )
    image.resize((size * 2, size * 2), Image.Resampling.LANCZOS).save(
        ICONSET / f"icon_{size}x{size}@2x.png"
    )

image.resize((512, 512), Image.Resampling.LANCZOS).save(ASSETS / "icon-512.png")
image.save(
    ASSETS / "icon.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
image.save(
    ASSETS / "icon.icns",
    format="ICNS",
    sizes=[(16, 16), (32, 32), (128, 128), (256, 256), (512, 512), (1024, 1024)],
)
