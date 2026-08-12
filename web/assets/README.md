# Character assets

## Катерина

`katerina.webp` — прямой production asset из пользовательского locked visual reference.

Канон: лицо, пропорции, татуировки и **обязательное тёмно-красное каре** нельзя переосмысливать без прямого решения пользователя.

## Егор

`egor.webp` — временно зафиксированный first-slice portrait из текущего визуального концепта. Он пригоден только для первой playable-сцены и не является разрешением на массовое производство поз/CG.

Перед расширением романтической линии нужно создать и отдельно visually approve полноценный locked Egor reference sheet.

## Packed fallback

`packed/katerina/` остаётся transport-safe fallback для канонического референса Катерины. Нормальные бинарные `katerina.webp` / `egor.webp` имеют приоритет, если уже закоммичены.

`tools/materialize_packed_assets.py` умеет восстановить asset из любых отсортированных non-hidden chunks и не требует packed-директорию, если нормальный бинарный asset уже существует.
