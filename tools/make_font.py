# -*- coding: utf-8 -*-
"""
生成前三页用的网页字体：
  1. 「站酷快乐体」裁剪成只含这几页用字的 woff2（原字体 1.5MB、7000 多字）；
  2. 「Baloo 2 ExtraBold」只保留数字，给倒计时用（快乐体的数字太斜、不清晰）。

用法：
    python tools/make_font.py

字体源文件放在 tools/fonts/（不进仓库）：
    ZCOOLKuaiLe-Regular.ttf、Baloo2-wght.ttf
产物：
    assets/fonts/candy-subset.woff2
    assets/fonts/candy-num.woff2
"""
import os
import re
import sys

from fontTools import subset
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_TTF = os.path.join(ROOT, "tools", "fonts", "ZCOOLKuaiLe-Regular.ttf")
SRC_NUM_TTF = os.path.join(ROOT, "tools", "fonts", "Baloo2-wght.ttf")
OUT_WOFF2 = os.path.join(ROOT, "assets", "fonts", "candy-subset.woff2")
OUT_NUM_WOFF2 = os.path.join(ROOT, "assets", "fonts", "candy-num.woff2")
INDEX_HTML = os.path.join(ROOT, "index.html")

# 除页面文字外，额外保底字符：数字、英文、常用标点
EXTRA = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    " .,:;!?'\"-—/()[]&@#%+*=·、，。！？：；“”‘’（）【】《》…　"
)

# 照片墙标签由 JS 生成（manifest.json / 占位标签 / 占位图文字），
# 不在 index.html 里，单独把这批用字带上
GALLERY_TEXT = "刚出生满百天半岁九十一个月周年照待放入"


def page_text(html_src, page_index):
    """取出第 n 个 <section class="page ..."> 里的纯文字（去标签、去 emoji）"""
    blocks = re.findall(r'<section class="page[^"]*"[^>]*>(.*?)</section>',
                        html_src, re.S)
    if page_index >= len(blocks):
        return ""
    text = re.sub(r"<[^>]+>", "", blocks[page_index])
    return text


def is_emoji(ch):
    cp = ord(ch)
    return (0x1F000 <= cp <= 0x1FAFF) or (0x2600 <= cp <= 0x27BF) or cp in (0xFE0F, 0x200D)


# 字库缺「祎」（宝妈名字用字），用同字体的 礻 + 韦 拼一个。
# 参数：(glyph, 横向缩放, 纵向缩放, 墨迹左上角 x, y)
MISSING_GLYPHS = {
    0x794E: [
        ("uni793B", 0.42, 0.86, 120, 20),   # 礻
        ("uni97E6", 0.56, 0.88, 420, -10),  # 韦
    ],
}


def glyph_bbox(font, name):
    g = font["glyf"][name]
    g.recalcBounds(font["glyf"])
    return (g.xMin, g.yMin, g.xMax, g.yMax)


def add_composite(font, name, parts):
    """parts: [(glyphName, sx, sy, target_x0, target_y0)]，target 为缩放后墨迹左上角"""
    glyph_set = font.getGlyphSet()
    pen = TTGlyphPen(glyph_set)
    for src, sx, sy, tx0, ty0 in parts:
        x0, y0, _, _ = glyph_bbox(font, src)
        tpen = TransformPen(pen, (sx, 0, 0, sy, tx0 - sx * x0, ty0 - sy * y0))
        glyph_set[src].draw(tpen)
    order = font.getGlyphOrder() + [name]
    font["glyf"].glyphs[name] = pen.glyph()
    font.setGlyphOrder(order)
    font["glyf"].setGlyphOrder(order)
    font["hmtx"].metrics[name] = (920, 0)


def patch_missing(font, wanted):
    """为字体缺的字补上合成字形，返回补了哪些字"""
    cmap = font.getBestCmap()
    patched = []
    for cp, parts in MISSING_GLYPHS.items():
        ch = chr(cp)
        if ch not in wanted or cp in cmap:
            continue
        name = "uni%04X" % cp
        add_composite(font, name, parts)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[cp] = name
        patched.append(ch)
    return patched


def make_num_font():
    """倒计时数字：Baloo 2 ExtraBold，圆胖清楚，只保留数字和几个符号"""
    if not os.path.exists(SRC_NUM_TTF):
        print("跳过数字字体（找不到 %s）" % SRC_NUM_TTF)
        return
    font = TTFont(SRC_NUM_TTF)
    if "fvar" in font:
        instantiateVariableFont(font, {"wght": 800}, inplace=True)

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ["DSIG"]

    sub = subset.Subsetter(options=opts)
    sub.populate(text="0123456789:")
    sub.subset(font)

    font.flavor = "woff2"
    font.save(OUT_NUM_WOFF2)
    size = os.path.getsize(OUT_NUM_WOFF2)
    print("已生成 %s（%.1f KB）" % (OUT_NUM_WOFF2, size / 1024.0))


def main():
    if not os.path.exists(SRC_TTF):
        sys.exit("找不到字体源文件：%s" % SRC_TTF)
    if not os.path.exists(INDEX_HTML):
        sys.exit("找不到 index.html")

    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        html = f.read()

    chars = set(EXTRA) | set(GALLERY_TEXT)
    for i in (0, 1, 2):  # 第一页、第二页、第三页
        for ch in page_text(html, i):
            if ch.strip() and not is_emoji(ch):
                chars.add(ch)

    font = TTFont(SRC_TTF)
    patched = patch_missing(font, chars)
    cmap = font.getBestCmap()
    missing = sorted(c for c in chars if ord(c) not in cmap)
    keep = "".join(sorted(c for c in chars if ord(c) in cmap))

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ["DSIG"]

    sub = subset.Subsetter(options=opts)
    sub.populate(text=keep)
    sub.subset(font)

    os.makedirs(os.path.dirname(OUT_WOFF2), exist_ok=True)
    font.flavor = "woff2"
    font.save(OUT_WOFF2)

    size = os.path.getsize(OUT_WOFF2)
    print("字符数 %d，字形数 %d" % (len(keep), len(font.getGlyphOrder())))
    if patched:
        print("已补合成字形：%s" % "".join(patched))
    if missing:
        print("字体里没有的字符（会回退到系统字体）：%s" % "".join(missing))
    print("已生成 %s（%.1f KB）" % (OUT_WOFF2, size / 1024.0))
    make_num_font()


if __name__ == "__main__":
    main()
