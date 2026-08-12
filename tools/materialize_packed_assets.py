from __future__ import annotations

import base64
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


def _decode(parts_dir: Path) -> bytes:
    parts = _parts(parts_dir)
    if not parts:
        raise RuntimeError(f"No packed parts found in {parts_dir}")

    # Packed assets are transport chunks: every file is an independently
    # base64-encoded byte slice. Decode each slice first, then concatenate the
    # binary payload. Concatenating padded base64 strings before decoding is
    # invalid and previously caused a hidden Pillow fallback in clean CI.
    decoded_parts: list[bytes] = []
    try:
        for part in parts:
            compact = b"".join(part.read_bytes().split())
            decoded_parts.append(base64.b64decode(compact, validate=True))
        decoded = b"".join(decoded_parts)
        if _is_webp(decoded):
            return decoded
    except Exception as exc:
        raise RuntimeError(f"Invalid packed WebP chunks in {parts_dir}: {exc}") from exc

    raise RuntimeError(f"Packed asset in {parts_dir} is not a WebP payload")


def _write_webp(name: str) -> None:
    target = OUT / f"{name}.webp"
    source_dir = PACKED / name

    # A normal binary asset may be committed directly. In that case the packed
    # transport fallback is intentionally optional.
    if not _parts(source_dir):
        if target.exists() and target.stat().st_size:
            print(f"{name}: using committed binary asset")
            return
        raise RuntimeError(f"Neither packed source nor {target} exists")

    source = _decode(source_dir)
    target.write_bytes(source)
    print(f"{name}: materialized {len(source)} bytes")


def main() -> None:
    _write_webp("katerina")
    _write_webp("egor")
    print("materialized character assets")


if __name__ == "__main__":
    main()
