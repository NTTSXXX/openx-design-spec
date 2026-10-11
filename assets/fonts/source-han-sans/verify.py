"""Verify real outlines/advances at 400/600/900 against Adobe originals."""
import argparse
import hashlib
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--tools", type=Path)
    args = parser.parse_args()
    if args.tools:
        sys.path.insert(0, str(args.tools.resolve()))
    from fontTools.ttLib import TTFont
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    root = Path(__file__).resolve().parent
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf8"))
    proof = {"weights": [400, 600, 900], "regions": {}}
    for language, region in manifest["regions"].items():
        source_path = args.source_root / region["sourceFile"]
        if hashlib.sha256(source_path.read_bytes()).hexdigest() != region["sourceSha256"]:
            raise ValueError("Original source checksum changed")
        original = TTFont(source_path, lazy=True, recalcTimestamp=False)
        source_cmap = original.getBestCmap()
        text = "OpenX 123 永国图书工作账户设计输出，。" if language == "sc" else "OpenX 123 永國圖書工作帳戶設計輸出，。"
        wanted = {ord(char) for char in text if ord(char) in source_cmap}
        fonts = []
        for shard in region["shards"]:
            data = (root / shard["file"]).read_bytes()
            if hashlib.sha256(data).hexdigest() != shard["sha256"]:
                raise ValueError("Subset file checksum changed: " + shard["file"])
            points = set()
            for block in shard["unicodeRange"].split(","):
                endpoints = block[2:].split("-")
                first = int(endpoints[0], 16)
                last = int(endpoints[-1], 16)
                points.update(cp for cp in wanted if first <= cp <= last)
            if points:
                font = TTFont(root / shard["file"], lazy=True, recalcTimestamp=False)
                fonts.append((font, points))
        seen = set()
        shapes = []
        for weight in proof["weights"]:
            source_glyphs = original.getGlyphSet(location={"wght": weight})
            for font, points in fonts:
                cmap = font.getBestCmap()
                glyphs = font.getGlyphSet(location={"wght": weight})
                for cp in sorted(points):
                    expected = source_glyphs[source_cmap[cp]]
                    actual = glyphs[cmap[cp]]
                    src_pen = DecomposingRecordingPen(source_glyphs)
                    dest_pen = DecomposingRecordingPen(glyphs)
                    expected.draw(src_pen)
                    actual.draw(dest_pen)
                    if src_pen.value != dest_pen.value or expected.width != actual.width:
                        raise ValueError(f"Variable glyph differs: {language} U+{cp:04X} {weight}")
                    shapes.append({"character": chr(cp), "weight": weight, "advance": actual.width,
                                   "outlineSha256": hashlib.sha256(repr(dest_pen.value).encode()).hexdigest()})
                    seen.add(cp)
        if seen != wanted:
            raise ValueError("A proof character was not served by the subset inventory")
        family_names = sorted({font["name"].getDebugName(1) for font, _ in fonts})
        if family_names != [region["family"]]:
            raise ValueError("Unexpected internal font family")
        proof["regions"][language] = {"family": region["family"], "characters": len(wanted),
            "comparisons": len(shapes), "matchedOriginalOutlinesAndAdvances": True,
            "allResourceHashesMatched": len(region["shards"]), "samples": shapes}
    (root / "variable-glyph-proof.json").write_text(json.dumps(proof, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps({key: {name: value for name, value in region.items() if name != "samples"}
        for key, region in proof["regions"].items()}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
