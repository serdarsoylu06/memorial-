#!/usr/bin/env python3
"""Build a small, realistic test disk for Memorial.

    python3 scripts/make-test-disk.py /path/to/test-disk

Creates INBOX, ARCHIVE, REVIEW, EDITS and STAGING under the given folder and fills
them with generated photos carrying real EXIF (camera, capture time, GPS), a short
video, a sidecar, exact and near duplicates, and files with no metadata at all.
Needs Pillow; the video is made only when ffmpeg is installed. Refuses to write
into a folder that already has content.
"""
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image, ImageDraw
from PIL.TiffImagePlugin import IFDRational

SCENES = [
    ((96, 132, 150), (58, 84, 72)),
    ((176, 150, 110), (92, 70, 52)),
    ((70, 96, 130), (150, 160, 150)),
    ((140, 120, 140), (60, 60, 80)),
    ((110, 150, 120), (40, 70, 60)),
    ((190, 170, 140), (120, 96, 70)),
]


def picture(seed: int, size=(1800, 1200)) -> Image.Image:
    """A landscape-like image; every seed gives a visibly different frame."""
    sky, land = SCENES[seed % len(SCENES)]
    img = Image.new("RGB", size, sky)
    draw = ImageDraw.Draw(img)
    w, h = size
    horizon = int(h * (0.45 + 0.04 * (seed % 5)))
    for y in range(horizon):
        shade = tuple(min(255, int(c + (horizon - y) * 0.05)) for c in sky)
        draw.line([(0, y), (w, y)], fill=shade)
    draw.rectangle([0, horizon, w, h], fill=land)
    for i in range(6):
        x = (seed * 211 + i * 337) % w
        peak = horizon - 80 - ((seed * 53 + i * 97) % 240)
        draw.polygon([(x - 320, horizon), (x, peak), (x + 320, horizon)], fill=tuple(int(c * 0.8) for c in land))
    sun_x = (seed * 173) % (w - 200) + 100
    draw.ellipse([sun_x - 60, 120, sun_x + 60, 240], fill=(245, 232, 190))
    return img


def dms(value: float):
    """Degrees, minutes, seconds as the rationals EXIF expects."""
    value = abs(value)
    degrees = int(value)
    minutes = int((value - degrees) * 60)
    seconds = round((value - degrees - minutes / 60) * 3600, 2)
    return (IFDRational(degrees, 1), IFDRational(minutes, 1), IFDRational(int(seconds * 100), 100))


def exif_for(make: str, model: str, when: datetime, gps=None) -> Image.Exif:
    stamp = when.strftime("%Y:%m:%d %H:%M:%S")
    exif = Image.Exif()
    exif[0x010F] = make
    exif[0x0110] = model
    exif[0x0132] = stamp
    # Nested IFDs are written when assigned as dicts.
    exif[0x8769] = {0x9003: stamp, 0x9004: stamp}
    if gps:
        lat, lon = gps
        exif[0x8825] = {
            1: "N" if lat >= 0 else "S",
            2: dms(lat),
            3: "E" if lon >= 0 else "W",
            4: dms(lon),
        }
    return exif


def photo(path: Path, seed: int, make=None, model=None, when=None, gps=None, size=(1800, 1200)):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = picture(seed, size)
    if make:
        img.save(path, quality=88, exif=exif_for(make, model, when, gps))
    else:
        img.save(path, quality=88)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = Path(sys.argv[1]).expanduser().resolve()
    if root.exists() and any(root.iterdir()):
        sys.exit(f"{root} is not empty; choose a new folder.")
    for name in ["INBOX", "ARCHIVE", "REVIEW", "EDITS", "STAGING"]:
        (root / name).mkdir(parents=True, exist_ok=True)
    inbox = root / "INBOX"

    # 1. A named trip, two devices: Sony without GPS, iPhone with GPS (Kümbet, outside Giresun centre).
    trip = inbox / "2024-06-14_Kumbet-Yaylasi"
    start = datetime(2024, 6, 14, 9, 10)
    for i in range(6):
        photo(trip / f"DSC0{1001 + i}.JPG", i, "SONY", "ILCE-6700", start + timedelta(minutes=9 * i))
    (trip / "DSC01001.xmp").write_text("<x:xmpmeta/>\n")
    for i in range(3):
        photo(trip / f"IMG_{4101 + i}.JPG", 20 + i, "Apple", "iPhone 15 Pro",
              datetime(2024, 6, 14, 10, 40) + timedelta(minutes=14 * i), gps=(40.5601, 38.4412), size=(1200, 1600))

    # 2. A camera card dump: one day, two bursts five hours apart (should split into two sessions).
    card = inbox / "DCIM" / "100CANON"
    for i in range(5):
        photo(card / f"IMG_{7001 + i}.JPG", 40 + i, "Canon", "Canon EOS 6D", datetime(2024, 8, 14, 11, 0) + timedelta(minutes=6 * i))
    for i in range(4):
        photo(card / f"IMG_{7006 + i}.JPG", 50 + i, "Canon", "Canon EOS 6D", datetime(2024, 8, 14, 16, 30) + timedelta(minutes=5 * i))

    # 3. Loose everyday phone photos inside the Giresun bounding box.
    for i in range(4):
        photo(inbox / f"IMG_{4410 + i}.JPG", 60 + i, "Apple", "iPhone 15 Pro",
              datetime(2024, 6, 3, 18, 20) + timedelta(minutes=3 * i), gps=(40.9128, 38.3895), size=(1200, 1600))

    # 4. Files with no metadata, and an exact copy of a trip photo under another name.
    photo(inbox / "taramalar" / "scan_0012.png", 70)
    shutil.copy2(trip / "DSC01002.JPG", inbox / "taramalar" / "DSC01002 kopya.JPG")

    # 5. A short video, when ffmpeg is available.
    if shutil.which("ffmpeg"):
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "2",
             "-pix_fmt", "yuv420p", "-metadata", "creation_time=2024-06-14T12:05:00Z", str(trip / "C0001.MP4")],
            check=False,
        )

    # ARCHIVE: an earlier event, containing an exact duplicate and a resized near-duplicate.
    old = root / "ARCHIVE" / "2024" / "2024-05-19_Giresun-Adasi" / "Photos" / "Sony_a6700"
    for i in range(3):
        photo(old / f"DSC0{901 + i}.JPG", 80 + i, "SONY", "ILCE-6700", datetime(2024, 5, 19, 14, 0) + timedelta(minutes=4 * i))
    everyday = root / "ARCHIVE" / "2024" / "EVERYDAY" / "2024-05" / "Photos" / "Sony_a6700"
    everyday.mkdir(parents=True)
    shutil.copy2(old / "DSC0901.JPG", everyday / "DSC0901.JPG")
    Image.open(old / "DSC0902.JPG").resize((900, 600)).save(everyday / "DSC0902_kucuk.JPG", quality=70)

    # REVIEW: leftovers from an earlier run.
    photo(root / "REVIEW" / "bilinmeyen_01.jpg", 90)
    photo(root / "REVIEW" / "bilinmeyen_02.jpg", 91)
    shutil.copy2(root / "REVIEW" / "bilinmeyen_01.jpg", root / "REVIEW" / "bilinmeyen_01 kopya.jpg")

    files = sum(1 for p in root.rglob("*") if p.is_file())
    print(f"{files} files written under {root}")


if __name__ == "__main__":
    main()
