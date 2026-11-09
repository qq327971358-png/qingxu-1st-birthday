# -*- coding: utf-8 -*-
"""
生成邀请函使用的标题字 PNG（透明背景、糖果色贴纸字）与分享封面 og-cover.jpg。
粉色公主版配色 + 站酷快乐体（圆胖可爱）。

用法：python tools/make_titles.py
依赖：Pillow；字体源文件 tools/fonts/ZCOOLKuaiLe-Regular.ttf
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "img")
FONT_DIR = "C:/Windows/Fonts"
CANDY_FONT = os.path.join(ROOT, "tools", "fonts", "ZCOOLKuaiLe-Regular.ttf")
# 「清」在快乐体里笔画太挤，单独用幼圆（圆胖、笔画清楚），再靠描边加粗
ROUND_FONT = os.path.join(FONT_DIR, "simyou.ttf")

# 糖果色：草莓粉 / 蜜桃橙 / 蜂蜜黄
CANDY_PINK = (242, 121, 158)
CANDY_ORANGE = (255, 138, 96)
CANDY_YELLOW = (246, 190, 70)


def render_sticker(text, font_size, out_name, colors, rotations,
                   outer=13, inner=5, tracking=10, padding=28,
                   shadow_color=(210, 105, 138), shadow_alpha=0.42,
                   shadow_offset=(0, 6), shadow_blur=7,
                   font_overrides=None, inner_overrides=None):
    """
    每个字单独上色、描白边、轻微旋转，拼成一张贴纸字 PNG。
    inner 是同色描边（让字变胖），outer 是白色外描边（贴纸边）。
    font_overrides / inner_overrides 可给个别字单独换字体或描边宽度。
    """
    font_overrides = font_overrides or {}
    inner_overrides = inner_overrides or {}
    chars = []
    for ch, color, rot in zip(text, colors, rotations):
        font = ImageFont.truetype(font_overrides.get(ch, CANDY_FONT), font_size)
        inn = inner_overrides.get(ch, inner)
        canvas = Image.new("RGBA", (font_size * 2, font_size * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(canvas)
        cx = cy = font_size // 2
        d.text((cx, cy), ch, font=font, fill=(255, 255, 255, 255),
               stroke_width=outer, stroke_fill=(255, 255, 255, 255))
        d.text((cx, cy), ch, font=font, fill=color + (255,),
               stroke_width=inn, stroke_fill=color + (255,))
        piece = canvas.crop(canvas.getbbox())
        if rot:
            piece = piece.rotate(rot, expand=True, resample=Image.BICUBIC)
        chars.append(piece)

    width = sum(im.width for im in chars) + tracking * (len(chars) - 1) + padding * 2
    height = max(im.height for im in chars) + padding * 2

    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = padding
    for im in chars:
        layer.alpha_composite(im, (x, padding + (height - padding * 2 - im.height) // 2))
        x += im.width + tracking

    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    alpha = layer.split()[3].point(lambda v: int(v * shadow_alpha))
    shadow = Image.new("RGBA", (width, height), shadow_color + (255,))
    shadow.putalpha(alpha.filter(ImageFilter.GaussianBlur(shadow_blur)))
    out.alpha_composite(shadow, shadow_offset)
    out.alpha_composite(layer)

    out.save(os.path.join(OUT_DIR, out_name), optimize=True)
    print("saved", out_name, out.size)


def draw_crown(d, cx, cy, w, fill):
    """在 OG 图上画一顶小皇冠"""
    h = w * 0.55
    left = cx - w / 2
    pts = [
        (left, cy),
        (left + w * 0.06, cy - h),
        (left + w * 0.32, cy - h * 0.42),
        (cx, cy - h * 1.15),
        (left + w * 0.68, cy - h * 0.42),
        (left + w * 0.94, cy - h),
        (left + w, cy),
        (left + w, cy + h * 0.22),
        (left, cy + h * 0.22),
    ]
    d.polygon(pts, fill=fill)
    r = w * 0.035
    for px, py in ((left, cy - h), (cx, cy - h * 1.15), (left + w, cy - h)):
        d.ellipse([px - r, py - r, px + r, py + r], fill=fill)


def make_og():
    """分享卡片 1200x630 · 粉色公主"""
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H))
    px = img.load()
    for y in range(H):
        t = y / H
        r = int(253 + (238 - 253) * t)
        g = int(232 + (172 - 232) * t)
        b = int(240 + (198 - 240) * t)
        for x in range(W):
            px[x, y] = (r, g, b, 255)

    # 右上柔光：单独一层做径向渐变，避免多次叠加变成纯白
    gw = gh = 760
    glow = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    gp = glow.load()
    cx, cy = gw / 2.0, gh / 2.0
    for yy in range(gh):
        dy = (yy - cy) / cy
        for xx in range(gw):
            dx = (xx - cx) / cx
            dist = (dx * dx + dy * dy) ** 0.5
            if dist < 1:
                gp[xx, yy] = (255, 255, 255, int(80 * (1 - dist) ** 2))
    img.alpha_composite(glow, (600, -190))

    d = ImageDraw.Draw(img, "RGBA")

    def sparkle(x, y, r, color):
        d.polygon([
            (x, y - r), (x + r * .2, y - r * .2), (x + r, y), (x + r * .2, y + r * .2),
            (x, y + r), (x - r * .2, y + r * .2), (x - r, y), (x - r * .2, y - r * .2),
        ], fill=color)

    # 星屑点缀
    sparkle(905, 300, 13, (255, 175, 200, 190))
    sparkle(1065, 235, 9, (255, 255, 255, 200))
    sparkle(1130, 360, 7, (246, 190, 70, 170))
    # 金色小皇冠
    draw_crown(d, 150, 120, 86, (246, 190, 70, 235))

    name_font = ImageFont.truetype(CANDY_FONT, 150)
    sub_font = ImageFont.truetype(CANDY_FONT, 44)
    small_font = ImageFont.truetype(CANDY_FONT, 34)
    d.text((96, 158), "王清许", font=name_font, fill=CANDY_PINK + (255,))
    d.text((96, 366), "一周岁 · 周岁喜宴", font=sub_font, fill=(198, 88, 120, 255))
    d.text((96, 446), "2027.01.09  农历十二月初二", font=small_font, fill=(190, 130, 100, 255))
    d.text((96, 512), "JAYA 嘉雅 · 湿地宴会中心", font=small_font, fill=(186, 110, 130, 220))
    img.convert("RGB").save(os.path.join(OUT_DIR, "og-cover.jpg"), quality=88, optimize=True)
    print("saved og-cover.jpg")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.exists(CANDY_FONT):
        raise SystemExit("找不到字体：%s" % CANDY_FONT)
    render_sticker("王清许", 150, "title-name.png",
                   [CANDY_PINK, CANDY_ORANGE, CANDY_YELLOW], (-3, 2, -2),
                   outer=10, inner=4, tracking=12, padding=28,
                   font_overrides={"清": ROUND_FONT})
    render_sticker("邀请函", 130, "title-invitation.png",
                   [CANDY_ORANGE, CANDY_PINK, CANDY_YELLOW], (2, -2, 1),
                   outer=11, inner=2, tracking=10, padding=24)
    make_og()
