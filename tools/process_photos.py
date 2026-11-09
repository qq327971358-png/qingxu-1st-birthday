# -*- coding: utf-8 -*-
"""
宝宝照片处理管线：
1. 读取「宝宝照片」文件夹中的所有 JPG / PNG（HEIC 请先转成 JPG）
2. 自动校正手机方向 → 居中裁剪为竖版 3:4 → 长边 640px → 自适应压缩
3. 按 EXIF 拍摄时间排序（从满月到周岁），自动标注月龄
4. 生成 assets/img/photo-01.jpg ... 与 manifest.json
5. 封面大图 assets/img/cover.jpg：文件名含「封面」或 cover 的照片优先，
   否则用第一张（最早的一张）
6. 想改某张的标签，可在「宝宝照片」里放 labels.json：
   {"IMG_1234.JPG": "第一次看海"}，文件名对应即可
7. 想调整某张的裁剪位置，可在「宝宝照片」里放 crop.json：
   {"02-1个月.jpg": {"x": 0.95}}，x 为 0~1（0 最左 / 0.5 居中 / 1 最右），
   竖图还可加 "y"（默认 0.42，略偏上）

用法：
    python tools/process_photos.py
"""
import json
import os
import re
import sys
from datetime import date, datetime

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "宝宝照片")
OUT_DIR = os.path.join(ROOT, "assets", "img")
MANIFEST = os.path.join(OUT_DIR, "manifest.json")
LABELS_JSON = os.path.join(SRC_DIR, "labels.json")
CROP_JSON = os.path.join(SRC_DIR, "crop.json")
EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
TARGET_KB = 80
COVER_TARGET_KB = 200
BIRTH_DATE = date(2026, 1, 16)  # 王清许生日


def list_photos():
    if not os.path.isdir(SRC_DIR):
        os.makedirs(SRC_DIR, exist_ok=True)
        return []
    files = []
    for name in os.listdir(SRC_DIR):
        if name.startswith("."):
            continue
        if os.path.splitext(name)[1].lower() in EXTS:
            files.append(os.path.join(SRC_DIR, name))
    files.sort(key=lambda p: os.path.basename(p).lower())
    return files


def exif_datetime(path):
    """照片里的拍摄时间；没有 EXIF 则返回 None"""
    try:
        with Image.open(path) as im:
            exif = im.getexif()
            # 36867 = DateTimeOriginal, 306 = DateTime
            for tag in (36867, 306):
                val = exif.get(tag)
                if not val:
                    continue
                m = re.match(r"(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})", str(val))
                if m:
                    return datetime(*[int(x) for x in m.groups()])
    except Exception:
        pass
    return None


def shot_time(path):
    """排序用：EXIF 时间，没有则退回文件修改时间"""
    t = exif_datetime(path)
    if t:
        return t
    try:
        return datetime.fromtimestamp(os.path.getmtime(path))
    except Exception:
        return None


def sort_by_time(files):
    """有「01-」「02-」这样的数字前缀时按前缀排；否则按拍摄时间"""
    def key(p):
        name = os.path.basename(p)
        m = re.match(r"^(\d+)[-_]", name)
        if m:
            return (0, int(m.group(1)), name.lower())
        t = shot_time(p)
        return (1, t.timestamp() if t else float("inf"), name.lower())
    try:
        return sorted(files, key=key)
    except Exception:
        return files


def name_label(path):
    """文件名「02-1个月.jpg」→ 标签「1个月」"""
    stem = os.path.splitext(os.path.basename(path))[0]
    m = re.match(r"^\d+[-_](.+)$", stem)
    return m.group(1).strip() if m else ""


def age_label(t):
    """按拍摄时宝宝多大自动生成标签"""
    if not t:
        return ""
    days = (t.date() - BIRTH_DATE).days
    if days < 20:
        return ""
    if days <= 50:
        return "满月"
    if 90 <= days <= 118:
        return "百天"
    if days >= 350:
        return "周岁"
    months = int(round(days / 30.4375))
    months = max(2, min(11, months))
    return "%d个月" % months


def load_label_overrides():
    if not os.path.exists(LABELS_JSON):
        return {}
    try:
        with open(LABELS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {str(k).lower(): str(v) for k, v in data.items()}
    except Exception as e:
        print("  [提示] labels.json 读取失败，已忽略：%s" % e)
    return {}


def is_cover_name(path):
    name = os.path.basename(path).lower()
    return ("封面" in name) or ("cover" in name)


def load_crop_overrides():
    """可选裁剪位置：{"文件名": {"x": 0.95, "y": 0.4}}，0 最左/最上，1 最右/最下"""
    if not os.path.exists(CROP_JSON):
        return {}
    try:
        with open(CROP_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            out = {}
            for k, v in data.items():
                if isinstance(v, dict):
                    out[str(k).lower()] = v
            return out
    except Exception as e:
        print("  [提示] crop.json 读取失败，已忽略：%s" % e)
    return {}


def center_crop_3_4(im, anchor=None):
    w, h = im.size
    target = 3.0 / 4.0
    ratio = w / float(h)
    ax = 0.5
    ay = 0.42  # 略偏上，保住人脸
    if isinstance(anchor, dict):
        try:
            ax = min(1.0, max(0.0, float(anchor.get("x", ax))))
        except (TypeError, ValueError):
            pass
        try:
            ay = min(1.0, max(0.0, float(anchor.get("y", ay))))
        except (TypeError, ValueError):
            pass

    if ratio > target:
        new_w = int(h * target)
        left = max(0, min(w - new_w, int((w - new_w) * ax)))
        box = (left, 0, left + new_w, h)
    else:
        new_h = int(w / target)
        top = max(0, min(h - new_h, int((h - new_h) * ay)))
        box = (0, top, w, top + new_h)
    return im.crop(box)


def save_adaptive(im, out_path, target_kb, start_long=640):
    """长边限制到 start_long，逐级降质量直到 <= target_kb"""
    w, h = im.size
    if max(w, h) > start_long:
        scale = start_long / float(max(w, h))
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    for q in (80, 72, 64, 56, 45):
        im.save(out_path, "JPEG", quality=q, optimize=True, progressive=True)
        kb = os.path.getsize(out_path) / 1024.0
        if kb <= target_kb:
            return kb
    # 最后手段：缩小尺寸
    for factor in (0.85, 0.7):
        small = im.resize((max(1, int(im.width * factor)), max(1, int(im.height * factor))),
                          Image.Resampling.LANCZOS)
        small.save(out_path, "JPEG", quality=70, optimize=True, progressive=True)
        kb = os.path.getsize(out_path) / 1024.0
        if kb <= target_kb:
            return kb
    return os.path.getsize(out_path) / 1024.0


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = list_photos()
    if not files:
        print("「宝宝照片」文件夹里还没有照片。")
        print("请把 JPG / PNG 照片放进：" + SRC_DIR)
        print("（iPhone 的 HEIC 照片请先在微信里『原图』发送再保存，或把相机格式改为『兼容性最佳』）")
        return 1

    files = sort_by_time(files)

    # 文件名含「封面」或 cover 的只做封面，不进照片墙
    cover_files = [p for p in files if is_cover_name(p)]
    gallery_files = [p for p in files if not is_cover_name(p)]
    if not gallery_files and cover_files:
        gallery_files = [cover_files[0]]
    cover_src = cover_files[0] if cover_files else (gallery_files[0] if gallery_files else None)

    overrides = load_label_overrides()
    crops = load_crop_overrides()
    photos = []
    total_kb = 0
    skipped = []

    for idx, path in enumerate(gallery_files):
        name = os.path.basename(path)
        try:
            with Image.open(path) as im:
                im = ImageOps.exif_transpose(im)
                im = im.convert("RGB")
                im = center_crop_3_4(im, crops.get(name.lower()))

                out_name = "photo-%02d.jpg" % (idx + 1)
                out_path = os.path.join(OUT_DIR, out_name)
                kb = save_adaptive(im, out_path, TARGET_KB, start_long=640)
                total_kb += kb

                label = (overrides.get(name.lower()) or name_label(path)
                         or age_label(exif_datetime(path)))
                photos.append({"src": out_name, "label": label})
                print("  %-24s -> %s  %-6s %.0f KB" % (name, out_name, label, kb))
        except Exception as e:
            skipped.append((name, str(e)))
            print("  [跳过] %s：%s" % (name, e))

    if cover_src:
        try:
            with Image.open(cover_src) as im:
                im = ImageOps.exif_transpose(im)
                im = im.convert("RGB")
                im = center_crop_3_4(im, crops.get(os.path.basename(cover_src).lower()))
                cover_kb = save_adaptive(im, os.path.join(OUT_DIR, "cover.jpg"),
                                         COVER_TARGET_KB, start_long=900)
                print("  封面 cover.jpg（来自 %s）  %.0f KB" % (os.path.basename(cover_src), cover_kb))
        except Exception as e:
            print("  [封面跳过] %s：%s" % (os.path.basename(cover_src), e))

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"photos": photos}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("")
    print("完成：%d 张照片，合计约 %.1f MB" % (len(photos), total_kb / 1024.0))
    print("manifest.json 已更新：" + MANIFEST)
    if skipped:
        print("以下文件读取失败（多为 HEIC 格式），请转换为 JPG 后重试：")
        for name, err in skipped:
            print("  - %s (%s)" % (name, err))
    return 0


if __name__ == "__main__":
    sys.exit(main())
