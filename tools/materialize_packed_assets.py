from __future__ import annotations

import base64
import hashlib
import io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKED = ROOT / "web" / "assets" / "packed"
OUT = ROOT / "web" / "assets"
KATERINA_SHA256 = "2c917b598a8d364846eb65ab01c0c36dd9e6662c31aca657f9919e9bc9be780d"


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


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _decode(parts_dir: Path) -> bytes:
    parts = _parts(parts_dir)
    if not parts:
        raise RuntimeError(f"No packed parts found in {parts_dir}")

    # Packed image sources are one continuous base64 stream split only for
    # transport. Join every part first, restore terminal padding if necessary,
    # then perform one strict decode.
    compact = b"".join(b"".join(part.read_bytes().split()) for part in parts)
    compact += b"=" * ((-len(compact)) % 4)
    try:
        decoded = base64.b64decode(compact, validate=True)
    except Exception as exc:
        raise RuntimeError(f"Invalid packed base64 asset in {parts_dir}: {exc}") from exc

    if not _is_raster(decoded):
        raise RuntimeError(f"Packed asset in {parts_dir} is not a supported raster image")
    return decoded


def _verify_digest(name: str, data: bytes, expected_sha256: str | None) -> None:
    if not expected_sha256:
        return
    actual = _sha256(data)
    if actual != expected_sha256:
        raise RuntimeError(
            f"{name}: locked asset SHA-256 mismatch: expected {expected_sha256}, got {actual}"
        )


def _write_webp(
    name: str,
    *,
    packed_name: str | None = None,
    expected_sha256: str | None = None,
) -> None:
    target = OUT / f"{name}.webp"
    source_dir = PACKED / (packed_name or name)

    # A committed locked WebP wins only if it is structurally valid and, for a
    # locked asset, matches the expected digest. A stale/corrupted generated
    # file is rebuilt from the verified transport source instead of being
    # trusted merely because it starts with a RIFF header.
    if target.exists() and target.stat().st_size:
        existing = target.read_bytes()
        if _is_webp(existing):
            if not expected_sha256 or _sha256(existing) == expected_sha256:
                print(f"{name}: using committed binary asset sha256={_sha256(existing)}")
                return
            print(f"{name}: existing binary digest is stale; rebuilding from packed source")
        elif not _parts(source_dir):
            raise RuntimeError(f"Existing {target} is not a valid WebP")

    source = _decode(source_dir)
    _verify_digest(name, source, expected_sha256)

    if _is_webp(source):
        target.write_bytes(source)
        print(f"{name}: materialized {len(source)} bytes sha256={_sha256(source)}")
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
    output = target.read_bytes()
    if not _is_webp(output):
        raise RuntimeError(f"Converted {target} is not a valid WebP")
    print(f"{name}: converted packed raster to {target.name} sha256={_sha256(output)}")


def main() -> None:
    _write_webp(
        "katerina",
        packed_name="katerina-v2",
        expected_sha256=KATERINA_SHA256,
    )
    _write_webp("egor")
    print("materialized character assets")


if __name__ == "__main__":
    main()
