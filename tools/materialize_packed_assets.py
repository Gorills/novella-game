from __future__ import annotations

import base64
import io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKED = ROOT / "web" / "assets" / "packed"
OUT = ROOT / "web" / "assets"


def _parts(parts_dir: Path) -> list[Path]:
    if not parts_dir.exists():
        return []
    return sorted(
        p for p in parts_dir.iterdir()
        if p.is_file() and not p.name.startswith(".")
    )


def _is_webp(data: bytes) -> bool:
    return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"


def _is_raster(data: bytes) -> bool:
    return _is_webp(data) or data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff")


def _decode(parts_dir: Path) -> bytes:
    parts = _parts(parts_dir)
    if not parts:
        raise RuntimeError(f"No packed parts found in {parts_dir}")

    # The legacy Katerina transport is one continuous base64 stream split into
    # several text files. Individual chunks are not independently padded, so
    # they must be concatenated before decoding. The historical transport also
    # omitted terminal base64 padding; restore only the mathematically required
    # number of '=' bytes before strict decoding.
    compact = b"".join(b"".join(part.read_bytes().split()) for part in parts)
    compact += b"=" * ((-len(compact)) % 4)
    try:
        decoded = base64.b64decode(compact, validate=True)
    except Exception as exc:
        raise RuntimeError(f"Invalid packed base64 asset in {parts_dir}: {exc}") from exc

    if not _is_raster(decoded):
        raise RuntimeError(f"Packed asset in {parts_dir} is not a supported raster image")
    return decoded


def _write_webp(name: str) -> None:
    target = OUT / f"{name}.webp"
    source_dir = PACKED / name

    # A committed locked WebP always wins. Never regenerate or reinterpret it
    # merely because a legacy packed fallback directory also exists.
    if target.exists() and target.stat().st_size:
        existing = target.read_bytes()
        if _is_webp(existing):
            print(f"{name}: using committed binary asset")
            return
        raise RuntimeError(f"Existing {target} is not a valid WebP")

    source = _decode(source_dir)
    if _is_webp(source):
        target.write_bytes(source)
        print(f"{name}: materialized {len(source)} bytes")
        return

    try:
        from PIL import Image
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Packed source needs raster-to-WebP conversion. Install Pillow "
            "or provide the committed locked WebP asset."
        ) from exc

    image = Image.open(io.BytesIO(source))
    image.save(target, "WEBP", quality=94, method=6)
    print(f"{name}: converted packed raster to {target.name}")


def main() -> None:
    _write_webp("katerina")
    _write_webp("egor")
    print("materialized character assets")


if __name__ == "__main__":
    main()
