# Character assets

## Катерина

`katerina.webp` — runtime/materialized production asset из пользовательского locked visual reference.

Канон: лицо, пропорции, татуировки и **обязательное тёмно-красное каре** нельзя переосмысливать без прямого решения пользователя.

В clean checkout бинарный `katerina.webp` может отсутствовать: канонический transport-safe source хранится в `packed/katerina/` как один base64-поток, разбитый на отсортированные части. Перед CI/browser QA он материализуется `tools/materialize_packed_assets.py`.

## Егор

`egor.webp` — временно зафиксированный first-slice portrait из текущего визуального концепта. Он пригоден только для первой playable-сцены и не является разрешением на массовое производство поз/CG.

Перед расширением романтической линии нужно создать и отдельно visually approve полноценный locked Egor reference sheet.

## Packed fallback и materialization

`packed/katerina/` — transport-safe canonical fallback. Части нельзя декодировать независимо: это фрагменты одного непрерывного base64-потока.

Каноническая команда materialization:

```bash
python -m pip install "Pillow>=11,<13"
python tools/materialize_packed_assets.py
```

Если нормальный committed WebP существует, materializer использует его как приоритетный и не пересоздаёт из packed source.
