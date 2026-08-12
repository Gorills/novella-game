# Vertical Slice QA — baseline v0.1

## Automated

Фактически выполнено перед merge baseline:

- `npm test` — 4/4 pass;
- `npm run validate` — pass;
- `npm run agent-smoke` — полный проход до `ending`, `completed=true`;
- browser smoke — полный проход без page/console errors.

## Visual review

Фактически просмотрены реальные browser screenshots:

- main menu;
- phone overlay;
- crime investigation;
- seal tracing mini-game;
- Egor first meeting;
- investigation board;
- ending.

Проверены viewports:

- 1920×1080;
- 1366×768.

## Self-review finding and fix

Первый вариант сцены Егора оставлял за portrait случайно видимую часть sprite Катерины и слишком крупно масштабировал portrait. Это было обнаружено только после просмотра реального screenshot. Сцену исправили: Катерина убрана из POV-кадра, portrait Егора уменьшен до приемлемого масштаба и добавлен controlled vignette.

Этот пример является причиной обязательного visual gate: код и automated tests такую проблему не обнаруживали.

## Known production boundary

Текущий Egor portrait годится для первого slice, но перед массовым производством CG/poses ему нужен отдельный locked reference pack. Катерина уже locked через `web/assets/katerina.webp` и не должна перегенерироваться.
