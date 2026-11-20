#!/usr/bin/env python3
"""Builds Aether Hub brand assets from assets_raw/ (icons, covers, splash art)."""
from __future__ import annotations

import math
import os
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets_raw"
PUBLIC = ROOT / "public"
COVERS = PUBLIC / "covers"

VIOLET = (139, 92, 246)
LAVENDER = (196, 181, 253)
DEEP = (18, 14, 34)


def rounded_mask(size: int, radius: int) -> Image.Image:
    # Supersample so the corners are smooth.
    scale = 4
    mask = Image.new("L", (size * scale, size * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, size * scale - 1, size * scale - 1), radius=radius * scale, fill=255
    )
    return mask.resize((size, size), Image.LANCZOS)


def make_icon() -> None:
    source = Image.open(RAW / "apiconslauncher.jpeg").convert("RGB")
    # The neon tile occupies 204..819 on the 1024 canvas, with a corner
    # radius of ~150/616. Crop exactly to the tile and use a matching mask so
    # no black square corners survive.
    tile = source.crop((204, 204, 820, 820)).resize((824, 824), Image.LANCZOS)

    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))

    glow = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle((96, 96, 928, 928), radius=230, fill=(124, 77, 255, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(54))
    canvas.alpha_composite(glow)

    tile_rgba = tile.convert("RGBA")
    tile_rgba.putalpha(rounded_mask(824, 201))
    canvas.alpha_composite(tile_rgba, (100, 100))

    # Soft inner highlight along the top edge.
    highlight = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.rounded_rectangle((118, 112, 906, 906), radius=176, outline=(196, 181, 253, 46), width=3)
    highlight = highlight.filter(ImageFilter.GaussianBlur(2))
    canvas.alpha_composite(highlight)

    canvas.save(ROOT / "assets_raw" / "icon-master.png")

    # Also write a plain 640px logo for in-app use (keeps the original frame).
    logo = Image.open(RAW / "iconsinlauncher.jpg").convert("RGB")
    side = min(logo.size)
    left = (logo.width - side) // 2
    top = (logo.height - side) // 2
    logo = logo.crop((left, top, left + side, top + side)).resize((640, 640), Image.LANCZOS)
    logo.save(PUBLIC / "logo.png")

    # Wide hero crop of the logo for the splash/hero backdrops.
    hero = Image.open(RAW / "iconsinlauncher.jpg").convert("RGB").crop((90, 90, 927, 927))
    hero = hero.resize((900, 900), Image.LANCZOS)
    hero.save(PUBLIC / "logo-art.jpg", quality=92)


def gradient_canvas(size: tuple[int, int], seed: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    rng = np.random.default_rng(seed)
    w, h = size
    y = np.linspace(0, 1, h)[:, None]
    base = np.zeros((h, w, 3), dtype=np.float32)
    for c in range(3):
        base[:, :, c] = top[c] * (1 - y) + bottom[c] * y

    xs = np.linspace(-1, 1, w)[None, :]
    ys = np.linspace(-1, 1, h)[:, None]
    for _ in range(4):
        cx, cy = rng.uniform(-0.8, 0.8), rng.uniform(-0.7, 0.7)
        radius = rng.uniform(0.35, 0.65)
        d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        glow = np.clip(1 - d / radius, 0, 1) ** 2
        tint = np.array([rng.uniform(0.45, 0.85), rng.uniform(0.25, 0.55), rng.uniform(0.85, 1.0)], dtype=np.float32)
        base += glow[:, :, None] * tint * 70

    base += rng.normal(0, 3.0, base.shape)
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))


def find_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=1 if "Helvetica" in path and bold else 0)
            except Exception:
                continue
    return ImageFont.load_default()


def tracked_text(draw: ImageDraw.ImageDraw, xy, text, font, fill, tracking=6, anchor=None):
    if anchor is None:
        x, y = xy
    else:
        x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def make_cover(kind: str) -> None:
    if kind == "drumkit":
        img = gradient_canvas((1200, 750), 7, (26, 18, 46), (9, 7, 18))
        draw = ImageDraw.Draw(img, "RGBA")
        # Concentric rings + kick-like circle.
        for r in range(80, 520, 46):
            draw.ellipse((930 - r, 520 - r, 930 + r, 520 + r), outline=(196, 181, 253, 18), width=2)
        draw.ellipse((770, 360, 1090, 680), outline=(232, 121, 249, 120), width=3)
        draw.ellipse((806, 396, 1054, 644), outline=(139, 92, 246, 70), width=2)
        draw.text((96, 118), "AETHER", font=find_font(96), fill=(245, 243, 255))
        draw.text((100, 236), "808 ESSENTIALS", font=find_font(40), fill=(196, 181, 253))
        draw.line((100, 320, 430, 320), fill=(139, 92, 246, 160), width=3)
        draw.text((100, 360), "10 punchy kicks · 808s · hats\nmixed and ready for the club", font=find_font(26, False), fill=(167, 159, 196), spacing=12)
        draw.text((100, 632), "DRUMKIT  /  V1.1", font=find_font(22), fill=(139, 92, 246))
    elif kind == "presets":
        img = gradient_canvas((1200, 750), 12, (34, 22, 58), (10, 8, 20))
        draw = ImageDraw.Draw(img, "RGBA")
        # Waveform.
        rng = random.Random(4)
        for i in range(64):
            x = 620 + i * 8
            amp = int(abs(math.sin(i * 0.41)) * rng.uniform(30, 180))
            draw.rounded_rectangle((x, 420 - amp, x + 4, 420 + amp), radius=3, fill=(196, 181, 253, 90))
        draw.text((96, 118), "AETHER", font=find_font(96), fill=(245, 243, 255))
        draw.text((100, 236), "VOCAL CHAIN", font=find_font(40), fill=(196, 181, 253))
        draw.line((100, 320, 430, 320), fill=(139, 92, 246, 160), width=3)
        draw.text((100, 360), "Mix-ready chains for FL Studio\nclean, airy and loud", font=find_font(26, False), fill=(167, 159, 196), spacing=12)
        draw.text((100, 632), "PRESETS  /  V1.1", font=find_font(22), fill=(139, 92, 246))
    else:
        raise ValueError(kind)

    # Vignette + noise feel.
    w, h = img.size
    vignette = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-w * 0.25, -h * 0.35, w * 1.25, h * 1.35), fill=180)
    vignette = vignette.filter(ImageFilter.GaussianBlur(160))
    dark = Image.new("RGBA", (w, h), (5, 4, 10, 255))
    img = Image.composite(img.convert("RGBA"), Image.alpha_composite(img.convert("RGBA"), dark), vignette)

    img.convert("RGB").save(COVERS / f"{kind}.jpg", quality=90)


def make_plugin_cover() -> None:
    candidates = [
        RAW / "vocal_strip_v1_1.png",
        RAW / "vocal_strip_v1.1.png",
        RAW / "plugin-preview.png",
    ]
    source_path = next((path for path in candidates if path.is_file()), RAW / "plugin-preview.png")
    source = Image.open(source_path).convert("RGB")
    target = (1200, 750)
    scale = max(target[0] / source.width, target[1] / source.height)
    resized = source.resize((int(source.width * scale), int(source.height * scale)), Image.LANCZOS)
    left = (resized.width - target[0]) // 2
    top = (resized.height - target[1]) // 2
    resized.crop((left, top, left + target[0], top + target[1])).save(
        COVERS / "aether-vocal-strip-v1-1.jpg", quality=90
    )


def make_dmg_background() -> None:
    w, h = 660, 420
    img = gradient_canvas((w, h), 21, (22, 15, 40), (7, 5, 13))
    draw = ImageDraw.Draw(img, "RGBA")

    # Soft halo behind the app icon / Applications shortcut.
    for cx, cy, radius, tint in [(180, 195, 130, (139, 92, 246, 55)), (480, 195, 90, (196, 181, 253, 30))]:
        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=tint)
        glow = glow.filter(ImageFilter.GaussianBlur(46))
        img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
        draw = ImageDraw.Draw(img, "RGBA")

    font = find_font(22)
    small = find_font(10)
    tracked_text(draw, (0, 42), "AETHER HUB", font, (232, 222, 255), tracking=10)
    draw = ImageDraw.Draw(img, "RGBA")
    # Center the wordmark.
    text_width = sum(draw.textlength(ch, font=font) + 10 for ch in "AETHER HUB") - 10
    draw.rectangle((0, 30, w, 82), fill=(10, 7, 18, 255))
    tracked_text(draw, ((w - text_width) / 2, 42), "AETHER HUB", font, (236, 228, 255), tracking=10)
    draw.text((0, 70), "plugins · kits · presets", font=small, fill=(150, 140, 176))
    sub_width = draw.textlength("plugins · kits · presets", font=small)
    draw.rectangle((0, 68, w, 88), fill=(10, 7, 18, 255))
    draw.text(((w - sub_width) / 2, 72), "plugins · kits · presets", font=small, fill=(150, 140, 176))

    # Arrow between icons.
    draw.line((290, 196, 380, 196), fill=(139, 92, 246, 150), width=2)
    draw.polygon([(380, 190), (394, 196), (380, 202)], fill=(196, 181, 253, 190))

    draw.text((150, 328), "Drag Aether Hub into Applications", font=find_font(11), fill=(160, 150, 188))
    (ROOT / "src-tauri" / "dmg").mkdir(parents=True, exist_ok=True)
    img.save(ROOT / "src-tauri" / "dmg" / "background.png")


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)
    COVERS.mkdir(exist_ok=True)
    make_icon()
    make_plugin_cover()
    make_cover("drumkit")
    make_cover("presets")
    make_dmg_background()
    print("assets ready")


if __name__ == "__main__":
    main()
