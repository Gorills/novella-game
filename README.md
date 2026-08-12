# Echo of Seven Seals / «Эхо семи печатей»

Романтическая мистическая narrative game с детективным расследованием, вампирами, магией и способностями.

Главная героиня — 21-летняя Катерина. Её татуировки постепенно раскрываются как система магических печатей, связанная с прошлым, скрытым устройством мира и серией исчезновений. Основной романтический персонаж — Егор, вампир неизвестного возраста, отношения с которым строятся на доверии, границах и скрываемой правде.

## Любому новому чату/агенту

Сначала прочитать [`AGENTS.md`](AGENTS.md). Там находится обязательный Definition of Done: реальный запуск, gameplay smoke, screenshots, visual review, self-review PR и merge в `main`.

Канон: [`docs/CANON.md`](docs/CANON.md).

## Катерина — locked reference

`web/assets/katerina.webp` — единственный канонический visual reference Катерины.

**Каре обязательно.** Нельзя заменять его длинными волосами или генерировать новую Катерину без прямого решения пользователя.

## Playable baseline

Текущий baseline: **«Пролог: След»**.

Он включает:

- стартовое меню;
- телефон и диалог с Софьей;
- исследование места происшествия;
- три улики;
- интерактивную активацию Печати Следа;
- Эхо;
- первую встречу с Егором;
- доску расследования;
- первую рабочую гипотезу;
- agent-playable API поверх того же game core.

### Запуск

```bash
cd web
python3 -m http.server 8080
```

Открыть `http://localhost:8080`.

### Проверки

```bash
cd web
npm test
npm run validate
npm run agent-smoke
```

Browser visual smoke обязателен перед заявлением «готово» для заметных UI/gameplay изменений: см. [`docs/03-production/QUALITY_GATE.md`](docs/03-production/QUALITY_GATE.md).

## Основные документы

- [`docs/00-vision/VISUAL_BIBLE.md`](docs/00-vision/VISUAL_BIBLE.md) — визуальный язык и character lock;
- [`docs/01-narrative/CHARACTERS.md`](docs/01-narrative/CHARACTERS.md) — Катерина, Егор и центральный cast;
- [`docs/01-narrative/WORLD.md`](docs/01-narrative/WORLD.md) — вампиры, Эхо, резонанс и семь печатей;
- [`docs/01-narrative/STORY_OUTLINE.md`](docs/01-narrative/STORY_OUTLINE.md) — центральное расследование;
- [`docs/01-narrative/PROLOGUE_BEAT_SHEET.md`](docs/01-narrative/PROLOGUE_BEAT_SHEET.md) — драматургия playable slice;
- [`docs/02-game-design/MECHANICS.md`](docs/02-game-design/MECHANICS.md) — расследование, отношения и способности;
- [`docs/03-production/QUALITY_GATE.md`](docs/03-production/QUALITY_GATE.md) — обязательная проверка качества;
- [`docs/03-production/VERTICAL_SLICE_QA.md`](docs/03-production/VERTICAL_SLICE_QA.md) — фактическая QA baseline.
