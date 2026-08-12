# Novella Game

Романтическая мистическая новелла с детективным расследованием, вампирами, магией и системными игровыми механиками.

Главная героиня — 21-летняя Катерина. Её татуировки постепенно раскрываются как система магических печатей, связанная с её прошлым, скрытым устройством мира и центральным расследованием. Основной романтический персонаж — Егор, вампир неизвестного возраста, отношения с которым строятся на доверии, границах и конфликте скрываемой правды.

## Foundation

Канонический индекс: [`docs/CANON.md`](docs/CANON.md)

Основные документы:

- [`docs/00-vision/CONCEPT.md`](docs/00-vision/CONCEPT.md) — high concept, темы, tone и столпы игры;
- [`docs/00-vision/VISUAL_BIBLE.md`](docs/00-vision/VISUAL_BIBLE.md) — визуальное направление и правила консистентности персонажей;
- [`docs/01-narrative/CHARACTERS.md`](docs/01-narrative/CHARACTERS.md) — Катерина, Егор и центральный cast;
- [`docs/01-narrative/WORLD.md`](docs/01-narrative/WORLD.md) — вампиры, Эхо, резонанс и семь печатей;
- [`docs/01-narrative/STORY_OUTLINE.md`](docs/01-narrative/STORY_OUTLINE.md) — центральное расследование и структура истории;
- [`docs/02-game-design/MECHANICS.md`](docs/02-game-design/MECHANICS.md) — расследование, отношения, способности и fail-forward;
- [`docs/03-production/AI_PLAYABILITY.md`](docs/03-production/AI_PLAYABILITY.md) — обязательный agent-playable контракт;
- [`docs/03-production/VERTICAL_SLICE.md`](docs/03-production/VERTICAL_SLICE.md) — объём и acceptance первого playable slice.

## Техническое направление

Предварительная цель для первого vertical slice: **Ren'Py 8.x + отдельное Python game core**. UI человека и agent driver должны вызывать одни и те же игровые действия над одним состоянием.

Движок окончательно фиксируется после проверки требований vertical slice, до масштабирования производства контента.

## Текущий этап

Narrative/game-design foundation → beat sheet пролога → технический bootstrap → vertical slice «Пролог + Глава 1».
