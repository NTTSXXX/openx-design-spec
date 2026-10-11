"""Rebuild the self-hosted UI subsets from Adobe's pinned, genuine Source Han Sans.

Requires Python 3.12, fonttools[woff]==4.62.1. No outlines, advances, weights,
hinting, or artwork aliases are edited. OFL Reserved Font Name is respected by
renaming this derivative's internal family to OpenX Han UI SC / TC.
"""
from __future__ import annotations

import argparse
import concurrent.futures
from collections import Counter
import hashlib
import json
import logging
from pathlib import Path
import re
import sys
import time
import urllib.request

COMMIT = "a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2"
BASE = f"https://raw.githubusercontent.com/adobe-fonts/source-han-sans/{COMMIT}/"
SOURCE_HASHES = {
    "CN": "25a01e41b5cc99893eb35a6cd2cc7611841dc19eb03cbaf7f0c1de8210f2ba0b",
    "TW": "cf6889f4c0f1adeaf814ca3e98cc692d9e2d706501cf7545b9b58f6e3966b6ac",
}
OUT = Path(__file__).resolve().parent
FONT_ROOT = OUT.parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def ranges(points):
    grouped = []
    for value in sorted(points):
        if grouped and value == grouped[-1][1] + 1:
            grouped[-1][1] = value
        else:
            grouped.append([value, value])
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in grouped)


def read_font(path):
    from fontTools.ttLib import TTFont
    return TTFont(path, lazy=True, recalcTimestamp=False)


def create_subset(job):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    source, language, label, points = job
    font = read_font(source)
    original_map = font.getBestCmap()
    expected_metrics = {cp: font["hmtx"][original_map[cp]] for cp in points}
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    options.recalc_timestamp = False
    options.canonical_order = True
    selectors = set()
    for table in font["cmap"].tables:
        if table.format == 14:
            selectors.update(table.uvsDict)
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=set(points) | selectors)
    worker.subset(font)
    family = f"OpenX Han UI {language.upper()}"
    postscript = f"OpenXHanUI{language.upper()}"
    for record in font["name"].names:
        if record.nameID in [1, 3, 4, 6, 16, 21, 25] or record.nameID >= 256:
            value = record.toUnicode()
            value = re.sub(r"SourceHanSans(?:CN|TW|SC|TC)(?:VF)?", postscript, value)
            value = re.sub(r"Source Han Sans (?:CN|TW|SC|TC)(?: VF)?", family, value)
            if record.nameID in [1, 16, 21]:
                value = family
            elif record.nameID == 3:
                value = f"OpenX Han UI 2.005;{language};{label}"
            elif record.nameID == 4:
                value = family + " Variable"
            elif record.nameID == 6:
                value = postscript + "-ExtraLight"
            record.string = value.encode(record.getEncoding())
    font["name"].setName(family, 16, 3, 1, 0x409)
    font.flavor = "woff2"
    folder = OUT / language
    folder.mkdir(exist_ok=True)
    temporary = folder / (label + ".woff2")
    font.save(temporary)
    data = temporary.read_bytes()
    file_name = label + "-" + digest(data)[:12] + ".woff2"
    target = folder / file_name
    temporary.replace(target)
    verified = TTFont(target, recalcTimestamp=False)
    coverage = verified.getBestCmap()
    if set(coverage) != set(points):
        raise ValueError(f"Incomplete or unexpected cmap: {language}/{label}")
    for cp, expected in expected_metrics.items():
        if verified["hmtx"][coverage[cp]] != expected:
            raise ValueError(f"Changed advance or bearing U+{cp:04X}: {language}/{label}")
    axis = verified["fvar"].axes[0]
    if (axis.axisTag, axis.minValue, axis.maxValue) != ("wght", 250, 900):
        raise ValueError("Weight axis changed")
    original = read_font(source)
    original_glyf = original["glyf"]
    subset_glyf = verified["glyf"]
    # Every encoded glyph retains the same TrueType coordinates. Composite
    # glyphs retain their own transforms; the subsetter preserves dependencies.
    compared = 0
    for cp in points:
        src = original_glyf[original_map[cp]]
        dest = subset_glyf[coverage[cp]]
        if src.numberOfContours >= 0:
            if src.getCoordinates(original_glyf) != dest.getCoordinates(subset_glyf):
                raise ValueError(f"Changed outline U+{cp:04X}: {language}/{label}")
            compared += 1
    return {
        "file": f"{language}/{file_name}", "label": label,
        "sha256": digest(data), "bytes": len(data),
        "codepoints": len(points), "unicodeRange": ranges(points),
        "metricsMatched": len(points), "simpleOutlinesMatched": compared,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--tools", type=Path)
    parser.add_argument("--ui-root", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    if args.tools:
        sys.path.insert(0, str(args.tools.resolve()))
    import fontTools
    logging.getLogger("fontTools.subset").setLevel(logging.ERROR)
    started = time.time()
    counts = Counter()
    for folder in [args.ui_root / "studio", args.ui_root / "docs", FONT_ROOT.parent.parent]:
        for path in folder.glob("*.tsx" if folder.name == "studio" else "*.html"):
            counts.update(ord(char) for char in path.read_text(encoding="utf8") if 0x3400 <= ord(char) <= 0x9FFF)
    for path in (args.ui_root / "studio").glob("*i18n*"):
        if path.is_file():
            counts.update(ord(char) for char in path.read_text(encoding="utf8") if 0x3400 <= ord(char) <= 0x9FFF)
    common = {cp for cp, _ in counts.most_common(1536)}
    common_list = sorted(common, key=lambda cp: (-counts[cp], cp))
    (OUT / "common-codepoints.json").write_text(json.dumps(common_list), encoding="utf8")
    license_data = (args.source_root / "LICENSE.txt").read_bytes()
    (OUT / "LICENSE.txt").write_bytes(license_data)
    manifest = {
        "font": "Adobe Source Han Sans / 思源黑体 / 思源黑體", "version": "2.005R",
        "commit": COMMIT, "releasedAt": "2025-06-18",
        "license": "SIL Open Font License 1.1; Reserved Font Name 'Source'",
        "licenseSha256": digest(license_data),
        "upstream": "https://github.com/adobe-fonts/source-han-sans/releases/tag/2.005R",
        "tool": f"fontTools {fontTools.__version__}", "cssWeights": [400, 900],
        "sourceWeights": [250, 900], "regions": {},
    }
    jobs = []
    for language, region in [("sc", "CN"), ("tc", "TW")]:
        name = f"SourceHanSans{region}-VF.ttf"
        source = args.source_root / name
        if digest(source.read_bytes()) != SOURCE_HASHES[region]:
            raise ValueError("Source font is not the pinned Adobe 2.005 original: " + name)
        font = read_font(source)
        coverage = set(font.getBestCmap())
        # Latin, figures, accents and punctuation are a small independent shard.
        base = {cp for cp in coverage if cp <= 0x2FF or 0x2000 <= cp <= 0x206F or 0x3000 <= cp <= 0x303F or 0xFF00 <= cp <= 0xFFEF}
        jobs.append((str(source), language, "latin-punctuation", sorted(base)))
        remaining = coverage - base
        for index in range(3):
            points = remaining.intersection(common_list[index * 512:(index + 1) * 512])
            if points:
                jobs.append((str(source), language, f"common-{index + 1}", sorted(points)))
                remaining -= points
        for index in sorted({cp // 256 for cp in remaining}):
            points = {cp for cp in remaining if cp // 256 == index}
            jobs.append((str(source), language, f"u{index * 256:05x}", sorted(points)))
        manifest["regions"][language] = {
            "family": f"OpenX Han UI {language.upper()}",
            "sourceFile": name, "sourceSha256": digest(source.read_bytes()),
            "sourceUrl": BASE + "Variable/TTF/Subset/" + name,
            "originalFamily": font["name"].getDebugName(1),
            "sourceCodepoints": len(coverage), "sourceGlyphs": font["maxp"].numGlyphs,
            "shards": [],
        }
    print(f"Building {len(jobs)} shards", flush=True)
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        # Windows child processes inherit the explicitly extended path.
        futures = {pool.submit(create_subset, job): job[1] for job in jobs}
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            language = futures[future]
            shard = future.result()
            manifest["regions"][language]["shards"].append(shard)
            if index % 12 == 0 or index == len(jobs):
                print(f"{index}/{len(jobs)} in {time.time()-started:.1f}s", flush=True)
    css = ["/* Genuine Adobe Source Han Sans 2.005 glyphs; OFL-compliant named derivatives.",
           " * See source-han-sans/README.md, LICENSE.txt and manifest.json.",
           " * Self-hosted complete official CN/TW regional inventories, on-demand WOFF2.",
           " * Artwork family aliases and canvas/export coordinates remain independent. */"]
    for language, region in manifest["regions"].items():
        region["shards"].sort(key=lambda shard: shard["label"])
        region["totalBytes"] = sum(shard["bytes"] for shard in region["shards"])
        region["subsetsCodepoints"] = sum(shard["codepoints"] for shard in region["shards"])
        if region["sourceCodepoints"] != region["subsetsCodepoints"]:
            raise ValueError("Complete regional character inventory not preserved")
        for shard in region["shards"]:
            css.extend(["@font-face {", f"  font-family: '{region['family']}';",
                "  font-style: normal;", "  font-weight: 400 900;",
                "  font-display: swap;", f"  src: url('source-han-sans/{shard['file']}') format('woff2');",
                f"  unicode-range: {shard['unicodeRange']};", "}"])
    css.extend(["", ":root {",
        "  --ui-font: 'OpenX Han UI SC', 'OpenX Han UI TC', sans-serif;",
        "  --ox-font: var(--ui-font);", "}",
        ":root:is(:lang(zh-Hant), :lang(zh-TW), :lang(zh-HK)) {",
        "  --ui-font: 'OpenX Han UI TC', 'OpenX Han UI SC', sans-serif;", "}",
        "/* UI inheritance only: canvas drawing selects its own saved font family. */",
        "body { font-family: var(--ui-font); font-synthesis: none; }",
        ":root :is(button, input, textarea, select) { font-family: var(--ui-font); font-synthesis: none; }",
        ":root :is(.ops-shell, .ops-login, .template-studio-header, .sm-inspector, .sm-toolstrip, .sm-template-library, .doc-nav, .page-head, .section-heading, .sheet-top) { font-family: var(--ui-font); font-synthesis: none; }",
        "/* Earlier specification applied font-family directly to every :lang node.",
        " * Reset that UI-only rule after old faces are declared; canvas remains bitmap. */",
        ":root[data-workspace-embed] :lang(zh-Hant),",
        ":root[data-workspace-embed] :lang(zh-TW),",
        ":root[data-workspace-embed] :lang(zh-HK),",
        ":root[data-template-standalone] :lang(zh-Hant),",
        ":root[data-template-standalone] :lang(zh-TW),",
        ":root[data-template-standalone] :lang(zh-HK) { font-family: var(--ui-font); font-synthesis: none; }",
        ":root .template-studio-identity h1 { font-family: var(--ui-font); }",
        "#layout-diagram text { font-family: var(--ui-font); font-synthesis: none; }", ""])
    css_bytes = "\n".join(css).encode("utf8")
    (FONT_ROOT / "source-han-sans.css").write_bytes(css_bytes)
    manifest["cssSha256"] = digest(css_bytes)
    manifest["buildSeconds"] = round(time.time() - started, 2)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps({"bytes": {key: value["totalBytes"] for key, value in manifest["regions"].items()}, "seconds": manifest["buildSeconds"]}), flush=True)


if __name__ == "__main__":
    main()
