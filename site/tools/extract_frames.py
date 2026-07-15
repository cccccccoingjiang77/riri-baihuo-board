# -*- coding: utf-8 -*-
"""
从广告视频拆解关键帧，按黄金五段式的时间轴均匀取帧，用于看板 Top 素材展示。
输出到 site/assets/frames/，并打印视频真实时长供数据层参考。
"""
import cv2, os

SRC = "/Users/congjiang/Downloads/media (3).mp4"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "frames")
OUT_DIR = os.path.abspath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

PREFIX = "m3"  # media(3) 素材前缀

v = cv2.VideoCapture(SRC)
fps = v.get(cv2.CAP_PROP_FPS)
total = int(v.get(cv2.CAP_PROP_FRAME_COUNT))
dur = total / fps

# 关键帧时间点（秒）：覆盖 钩子/痛点/解药/演示×2/收尾，避开纯黑首帧
points = [1.5, 12, 45, 95, 150, dur - 4]
labels = ["hook", "pain", "cure", "demo1", "demo2", "ending"]

saved = []
for i, (sec, lab) in enumerate(zip(points, labels), 1):
    sec = max(0.2, min(sec, dur - 0.3))
    v.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
    ok, frame = v.read()
    if not ok:
        print("read fail at", sec)
        continue
    # 竖屏 1080x1920 -> 等比缩到宽 360 控制体积
    h, w = frame.shape[:2]
    nw = 360
    nh = int(h * nw / w)
    frame = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_AREA)
    fn = f"{PREFIX}_{i}_{lab}.jpg"
    cv2.imwrite(os.path.join(OUT_DIR, fn), frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    saved.append((round(sec, 1), fn))

v.release()
print("DURATION_SEC", round(dur, 1))
print("SAVED:")
for s in saved:
    print(s)
