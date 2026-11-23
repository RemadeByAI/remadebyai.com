#!/usr/bin/env python3
"""Makes small copies of app screenshots for the screenshot grid on app pages.

assets/apps/<slug>/1.webp  ->  assets/apps/<slug>/thumb/1.webp  (at most 960 px wide)

build.js uses a thumbnail when one exists and links it to the full-size picture, which the
screenshot viewer opens. Run this after adding screenshots, then run `node build.js`:

    python3 tools/make-thumbs.py

Needs Pillow (pip install pillow). Existing thumbnails are kept unless the screenshot is newer.
Screenshots already 960 px wide or less don't get a thumbnail (the page uses them as they are).
"""
import os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'apps')
WIDTH = 960
made = kept = 0
for slug in sorted(os.listdir(ROOT)):
    folder = os.path.join(ROOT, slug)
    if not os.path.isdir(folder):
        continue
    for name in sorted(os.listdir(folder)):
        src = os.path.join(folder, name)
        ext = os.path.splitext(name)[1].lower()
        if not os.path.isfile(src) or ext not in ('.webp', '.png', '.jpg', '.jpeg'):
            continue
        dst = os.path.join(folder, 'thumb', name)
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            kept += 1
            continue
        with Image.open(src) as im:
            if im.width <= WIDTH:
                continue
            h = round(im.height * WIDTH / im.width)
            small = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB').resize((WIDTH, h), Image.LANCZOS)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if ext == '.webp':
                small.save(dst, 'WEBP', quality=80, method=6)
            elif ext == '.png':
                small.save(dst, 'PNG', optimize=True)
            else:
                small.convert('RGB').save(dst, 'JPEG', quality=82, optimize=True, progressive=True)
            made += 1
print(f'{made} thumbnails made, {kept} already up to date.')
