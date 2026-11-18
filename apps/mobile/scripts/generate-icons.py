# Genera los íconos de Abrigo: canvas cálido con dos volúmenes que se abrazan.
from PIL import Image, ImageDraw
import sys

CANVAS = (247, 241, 232)
SUN = (235, 201, 143)
SAGE = (63, 107, 87)
LEAF = (204, 216, 194)

def icon(size, pad_ratio=0.0):
    s = size * 4  # supersampling
    img = Image.new("RGB", (s, s), CANVAS)
    d = ImageDraw.Draw(img)
    p = s * pad_ratio
    inner = s - 2 * p
    def box(cx, cy, w, h):
        return [p + inner * (cx - w / 2), p + inner * (cy - h / 2), p + inner * (cx + w / 2), p + inner * (cy + h / 2)]
    d.ellipse(box(0.40, 0.44, 0.50, 0.56), fill=SUN)
    d.ellipse(box(0.60, 0.58, 0.52, 0.50), fill=LEAF)
    d.ellipse(box(0.50, 0.52, 0.30, 0.30), fill=SAGE)
    return img.resize((size, size), Image.LANCZOS)

icon(192).save("public/logo192.png")
icon(512).save("public/logo512.png")
icon(512, 0.12).save("public/logo512-maskable.png")
icon(1024).save("assets/icon.png")
icon(48).save("assets/favicon.png")
fg = icon(1024, 0.18)
fg.save("assets/android-icon-foreground.png")
Image.new("RGB", (1024, 1024), CANVAS).save("assets/android-icon-background.png")
print("ok")
