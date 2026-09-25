"""PWA 아이콘 생성: python3 scripts/make-icons.py (Pillow 필요)"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
BG, FG = (42, 120, 214), (255, 255, 255)
FONTS = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial Bold.ttf"]

def font(size):
    for f in FONTS:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def icon(size, name, radius=0.22, glyph=0.58):
    s = size * 4  # 크게 그리고 줄여서 가장자리를 부드럽게
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if radius:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius), fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)
    f = font(int(s * glyph))
    box = d.textbbox((0, 0), "₩", font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1]), "₩", font=f, fill=FG)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))

os.makedirs(OUT, exist_ok=True)
icon(192, "icon-192.png")
icon(512, "icon-512.png")
icon(512, "icon-maskable-512.png", radius=0, glyph=0.42)  # 안드로이드 마스크 안전영역
icon(180, "apple-touch-icon.png", radius=0)  # iOS가 알아서 둥글게 자름
print("ok")
