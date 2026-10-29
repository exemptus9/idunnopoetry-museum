#!/usr/bin/env python3
"""Generate public preview PNGs and favicons from reviewed project SVG files."""
import io
from pathlib import Path
from PIL import Image
import cairosvg
ROOT = Path(__file__).resolve().parents[1] / "museum-static/assets/brand"
def main():
    shares=sorted(ROOT.glob("*/share.svg"))
    assert len(shares)==11, f"Expected 11 named public brands, got {len(shares)}"
    for svg in shares:
        folder=svg.parent
        icon=folder/"icon.svg"
        assert icon.is_file(), f"Missing {icon}"
        for src,out,size in (
            (svg,folder/"share.png",(1200,630)),
            (icon,folder/"icon-192.png",(192,192)),
            (icon,folder/"apple-touch-icon.png",(180,180)),
        ):
            payload=cairosvg.svg2png(url=str(src),output_width=size[0],output_height=size[1])
            with Image.open(io.BytesIO(payload)) as img:
                assert img.format=="PNG" and img.size==size
            out.write_bytes(payload)
        with Image.open(folder/"icon-192.png") as img:
            img.save(folder/"favicon.ico",format="ICO",sizes=[(16,16),(32,32),(48,48),(64,64)])
        print(folder.name, "OG:1200x630, icon:192/180, favicon.ico")
if __name__=="__main__":
    main()
