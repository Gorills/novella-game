# Character assets

## Катерина

`katerina.webp` — runtime/materialized production asset из пользовательского locked visual reference.

Канон: лицо, пропорции, татуировки и **обязательное тёмно-красное каре** нельзя переосмысливать без прямого решения пользователя.

В clean checkout бинарный `katerina.webp` может отсутствовать. Канонический transport-safe source хранится в `packed/katerina-v2/` как один base64-поток, разбитый только для транспорта. Его ожидаемый SHA-256:

```text
2c917b598a8d364846eb65ab01c0c36dd9e6662c31aca657f9919e9bc9be780d
```

`tools/materialize_packed_assets.py` обязан проверить этот digest **до записи** `katerina.webp`. Несовпадение — жёсткая ошибка CI; повреждённый или частично перенесённый референс нельзя молча использовать в игре.

Старый `packed/katerina/` считается legacy transport и больше не является источником canonical asset.

## Егор

`egor.webp` — временно зафиксированный first-slice portrait из текущего визуального концепта. Он пригоден только для первой playable-сцены и не является разрешением на массовое производство поз/CG.

Перед расширением романтической линии нужно создать и отдельно visually approve полноценный locked Egor reference sheet.

## Packed fallback и materialization

Packed parts нельзя декодировать независимо: это фрагменты одного непрерывного base64-потока. Сначала части объединяются по имени, затем выполняется один strict base64 decode.

Каноническая команда materialization:

```bash
python -m pip install "Pillow>=11,<13"
python tools/materialize_packed_assets.py
```

Для locked Катерины валидный WebP определяется не только RIFF-заголовком, но и точным SHA-256. Это защищает visual QA от ситуации, когда формально похожий на WebP повреждённый файл проходит pipeline, но не декодируется браузером.
