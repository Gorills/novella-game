from __future__ import annotations

import base64
import io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKED = ROOT / "web" / "assets" / "packed"
OUT = ROOT / "web" / "assets"


def _decode(parts_dir: Path) -> bytes:
    parts = sorted(parts_dir.glob("pack*"))
    if not parts:
        raise RuntimeError(f"No packed parts found in {parts_dir}")

    raw = b"".join(part.read_bytes() for part in parts)
    compact = b"".join(raw.split())

    # Packed files may contain base64 text, hex text, or raw binary chunks.
    try:
        decoded = base64.b64decode(compact, validate=True)
        if decoded.startswith((b"RIFF", b"\x89PNG", b"\xff\xd8\xff")):
            return decoded
    except Exception:
        pass

    try:
        decoded = bytes.fromhex(compact.decode("ascii"))
        if decoded.startswith((b"RIFF", b"\x89PNG", b"\xff\xd8\xff")):
            return decoded
    except Exception:
        pass

    return raw


def _write_webp(name: str) -> None:
    source = _decode(PACKED / name)
    target = OUT / f"{name}.webp"

    if source.startswith(b"RIFF") and source[8:12] == b"WEBP":
        target.write_bytes(source)
        return

    from PIL import Image

    image = Image.open(io.BytesIO(source))
    image.save(target, "WEBP", quality=94, method=6)


def main() -> None:
    _write_webp("katerina")
    _write_webp("egor")
    print("materialized character assets")


if __name__ == "__main__":
    main()
