# -*- coding: utf-8 -*-
"""
把背景音乐转成适合手机播放的小体积 MP3（单声道 / 96kbps / 默认截取 100 秒 / 首尾淡入淡出）。

用法：
    python tools/transcode_audio.py 原曲.mp3 assets/audio/bgm.mp3 [秒数] [kbps]
"""
import os
import sys

import lameenc
import miniaudio


def convert(src, dst, seconds=100.0, kbps=96, sr=44100, fade=2.0):
    decoded = miniaudio.decode_file(
        src,
        output_format=miniaudio.SampleFormat.SIGNED16,
        nchannels=1,
        sample_rate=sr,
    )
    samples = decoded.samples
    max_n = int(seconds * sr)
    if len(samples) > max_n:
        samples = samples[:max_n]
    n = len(samples)
    if n <= 0:
        raise RuntimeError("没有解码出音频数据")

    fade_n = min(int(fade * sr), n // 2)
    for i in range(fade_n):
        g = i / float(fade_n)
        samples[i] = int(samples[i] * g)
        samples[n - 1 - i] = int(samples[n - 1 - i] * g)

    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(samples.tobytes()) + enc.flush()

    out_dir = os.path.dirname(os.path.abspath(dst))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    with open(dst, "wb") as f:
        f.write(data)

    size_kb = os.path.getsize(dst) / 1024.0
    print("saved %s  %.1fs  %.0f KB (%d kbps mono)" % (dst, min(len(samples) / float(sr), seconds), size_kb, kbps))
    return size_kb


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    dst = sys.argv[2]
    seconds = float(sys.argv[3]) if len(sys.argv) > 3 else 100.0
    kbps = int(sys.argv[4]) if len(sys.argv) > 4 else 96
    convert(src, dst, seconds, kbps)
