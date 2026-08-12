# Character assets

## Катерина

`katerina.webp` materializes from the packed source already stored in this repository. It is derived directly from the user-provided locked visual reference.

Канон: лицо, пропорции, татуировки и **обязательное тёмно-красное каре** нельзя переосмысливать без прямого решения пользователя.

## Егор

`egor.webp` is the accepted first-slice portrait. Before mass production of poses/CGs, create and lock a proper Egor reference pack.

## Packed source

`packed/katerina/` and `packed/egor/` are transport-safe source chunks used because the connected GitHub write API cannot accept a local binary path directly.

`tools/materialize_packed_assets.py` reconstructs normal image files. `.github/workflows/materialize-character-assets.yml` runs this automatically when the packed source/materializer changes.

Do not create new packed formats. If normal binary upload is available in a future environment, replace the transport layer while preserving the canonical image content.
