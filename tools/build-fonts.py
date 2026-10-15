#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把网页用到的字体子集化并下载到本地，生成 assets/css/fonts.css。

为什么要这么做：
1. 页面将来要上线，直接引 Google Fonts / jsDelivr 在境内不一定稳定；
2. 中文字体动辄 20MB，必须只打包页面真正用到的字。

用法（在项目根目录执行）：
    python3 tools/build-fonts.py

改完 index.html 的文案后重跑一次即可。
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")
FONT_DIR = os.path.join(ROOT, "assets", "fonts")
OUT_CSS = os.path.join(ROOT, "assets", "css", "fonts.css")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

LATIN_FAMILIES = [
    ("Caveat Brush", "https://fonts.googleapis.com/css2?family=Caveat+Brush&display=swap"),
    ("Caveat", "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap"),
    ("Patrick Hand", "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap"),
]

CN_CSS = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/lxgwwenkaigbscreen.css"


def fetch(url, binary=False):
    """用 curl 拉取，避免本机 Python 证书链没配好。"""
    cmd = ["curl", "-sL", "--max-time", "120", "--retry", "6", "--retry-all-errors",
           "--retry-delay", "2", "--retry-connrefused", "-A", UA, url]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"下载失败：{url}（curl {proc.returncode}）")
    return proc.stdout if binary else proc.stdout.decode("utf-8")


# ---------- 1. 收集页面用到的字符 ----------
def used_chars():
    html = open(HTML, encoding="utf-8").read()
    body = re.sub(r"<(script|style|svg)\b.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", body)
    text = (text.replace("&amp;", "&").replace("&lt;", "<")
                .replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'")
                .replace("&nbsp;", " "))
    chars = set(text)
    # 基础 ASCII + 常用中日韩标点（这些字符零散分布在多个分片里，必须留）
    chars |= set("0123456789"
                 "abcdefghijklmnopqrstuvwxyz"
                 "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                 " .,:;!?()[]{}<>/\\|-_+=*&%$#@~^'\"`"
                 "·—–…、。，；：？！「」『』《》〈〉（）【】“”‘’")
    chars.discard("\n")
    chars.discard("\t")
    chars.discard("\u3000")
    return {c for c in chars if c.strip() or c == " "}


# ---------- 2. 解析 unicode-range ----------
def parse_ranges(text):
    out = []
    if not text:
        return out
    for part in text.split(","):
        part = part.strip()
        if not part.lower().startswith("u+"):
            continue
        part = part[2:]
        if "-" in part:
            a, b = part.split("-", 1)
            try:
                out.append((int(a, 16), int(b, 16)))
            except ValueError:
                pass
        else:
            try:
                v = int(part, 16)
                out.append((v, v))
            except ValueError:
                pass
    return out


def covered(ranges, chars):
    hit = 0
    for c in chars:
        cp = ord(c)
        for a, b in ranges:
            if a <= cp <= b:
                hit += 1
                break
    return hit


def blocks(css):
    return re.findall(r"@font-face\s*\{(.*?)\}", css, flags=re.S)


def field(block, name):
    m = re.search(name + r"\s*:\s*([^;]+?)\s*(?:;|\Z)", block, flags=re.S)
    return m.group(1).strip() if m else None


def save(url, filename):
    """按 URL 去重下载，返回 (文件名, 字节数)。"""
    if url in _SAVED:
        return _SAVED[url]
    path = os.path.join(FONT_DIR, filename)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        _SAVED[url] = (filename, os.path.getsize(path))
        return _SAVED[url]
    data = fetch(url, binary=True)
    with open(path, "wb") as f:
        f.write(data)
    _SAVED[url] = (filename, len(data))
    return _SAVED[url]


_SAVED = {}


def main():
    os.makedirs(FONT_DIR, exist_ok=True)
    chars = used_chars()
    print(f"页面用到字符：{len(chars)} 个")
    out = ["/* 由 tools/build-fonts.py 自动生成，请勿手改 */\n"]

    # ---- 2.1 拉丁手写体 ----
    for family, css_url in LATIN_FAMILIES:
        print(f"\n[{family}]")
        css = fetch(css_url)
        grouped = {}   # url -> [name, ur, weights]
        for blk in blocks(css):
            comment = css[max(0, css.find(blk) - 40):css.find(blk)]
            name = field(blk, "font-family") or ""
            src = field(blk, "src") or ""
            weight = field(blk, "font-weight") or "400"
            ur = field(blk, "unicode-range")
            m = re.search(r"url\((https://[^)]+)\)", src)
            if not m:
                continue
            url = m.group(1)
            # 只保留 latin / latin-ext，其余语系页面用不上
            if ur and not re.search(r"latin", comment or ""):
                continue
            if ur and covered(parse_ranges(ur), chars) == 0:
                continue
            item = grouped.setdefault(url, [curly_free(name), ur, []])
            item[2].append(weight)

        for url, (name, ur, weights) in grouped.items():
            ints = sorted(int(w) for w in weights)
            rng = f"{ints[0]}" if ints[0] == ints[-1] else f"{ints[0]} {ints[-1]}"
            fn = f"{name.split()[0].lower()}-{ints[0]}-{url.rsplit('/', 1)[-1]}"
            fn, size = save(url, fn)
            print(f"  + {fn} ({size // 1024} KB)  weight:{rng}")
            out.append(
                "@font-face{\n"
                f"  font-family:'{name}';\n"
                "  font-style:normal;\n"
                f"  font-weight:{rng};\n"
                "  font-display:swap;\n"
                f"  src:url('../fonts/{fn}') format('woff2');\n"
                + (f"  unicode-range:{ur};\n" if ur else "")
                + "}\n"
            )

    # ---- 2.2 中文手写体（霞鹜文楷 Screen）----
    print("\n[LXGW WenKai Screen]")
    css = fetch(CN_CSS)
    base = CN_CSS.rsplit("/", 1)[0]
    kept = 0
    total = 0
    for blk in blocks(css):
        ur = field(blk, "unicode-range")
        src = field(blk, "src") or ""
        m = re.search(r"url\(([^)]+)\)", src)
        if not m:
            continue
        url = m.group(1).strip("'\"")
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            url = "https://cdn.jsdelivr.net" + url
        elif not url.startswith("http"):
            url = base + "/" + url.lstrip("./")
        if ur and covered(parse_ranges(ur), chars) == 0:
            continue
        fn = url.rsplit("/", 1)[-1]
        fn, size = save(url, fn)
        kept += 1
        total += size
        out.append(
            "@font-face{\n"
            "  font-family:'LXGW WenKai Screen';\n"
            "  font-style:normal;\n"
            "  font-weight:400;\n"
            "  font-display:swap;\n"
            f"  src:url('../fonts/{fn}') format('woff2');\n"
            f"  unicode-range:{ur};\n"
            "}\n"
        )
    print(f"  保留 {kept} 个分片，共 {total // 1024} KB")

    with open(OUT_CSS, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"\n写出 {os.path.relpath(OUT_CSS, ROOT)}")


def curly_free(s):
    return s.strip().strip("'\"")


if __name__ == "__main__":
    sys.exit(main())
