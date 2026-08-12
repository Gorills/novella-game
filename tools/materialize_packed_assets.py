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

    # Legacy packed assets are fallback transport only. Their format may differ
    # between old revisions; this code must never overwrite a valid committed
    # locked asset just because packed chunks are also present.
    raw = b"".join(part.read_bytes() for part in parts)
    compact = b"".join(raw.split())
    try:
        decoded = base64.b64decode(compact, validate=True)
    except Exception as exc:
        raise RuntimeError(f"Invalid packed WebP stream in {parts_dir}: {exc}") from exc
    if not _is_webp(decoded):
        raise RuntimeError(f"Packed asset in {parts_dir} is not a WebP payload")
    return decoded


def _write_webp(name: str) -> None:
    target = OUT / f"{name}.webp"
    source_dir = PACKED / name

    # Normal committed binary art is the source of truth. Validate its header
    # and return before even looking at legacy packed transport.
    if target.exists() and target.stat().st_size:
        existing = target.read_bytes()
        if _is_webp(existing):
            print(f"{name}: using committed locked WebP ({len(existing)} bytes)")
            return
        raise RuntimeError(f"Committed asset is not a valid WebP: {target}")

    if not _parts(source_dir):
        raise RuntimeError(f"Neither valid {target} nor packed source exists")

    source = _decode(source_dir)
    target.write_bytes(source)
    print(f"{name}: materialized fallback {len(source)} bytes")


def main() -> None:
    _write_webp("katerina")
    _write_webp("egor")
    print("materialized character assets")


if __name__ == "__main__":
    main()
