# Vertical Slice QA

## Automated gates

From `web/`:

```bash
npm test
npm run validate
npm run agent-smoke
npm run visual-qa
```

`visual-qa` is dependency-free and drives the same `window.__NOVELLA__` core API as the human UI. It captures the acceptance set with one Chromium process and guarantees cleanup of its own process group.

Expected screenshots:

- `01-menu-1920x1080.png`
- `02-apartment-1920x1080.png`
- `02b-phone-1920x1080.png`
- `03-investigation-1920x1080.png`
- `04-echo-1920x1080.png`
- `05-egor-1920x1080.png` — состояние до ответа;
- `05b-egor-direct-response-1920x1080.png` — состояние после прямого ответа, обязано визуально отличаться staging/camera distance, а не только текстом;
- `06-evidence-board-1920x1080.png`
- `07-menu-small-1366x768.png`
- `08-egor-small-1366x768.png`

## Mandatory human/art-direction review

Open every generated screenshot. Check composition, clipping, legibility, character consistency, excessive empty space, desktop responsiveness and whether the frame reads as a visual novel rather than a dashboard.

Для пары Катерина/Егор отдельно сравнить `05-egor` и `05b-egor-direct-response`: изменение границы/тона должно быть заметно через физическую дистанцию, свет и кадрирование, но лица и пропорции персонажей не должны «плыть».

If local Chromium is unstable, stop after the hard timeout. Do not loop/relaunch it. The GitHub Actions `visual-qa` job uploads the same screenshots as `visual-qa-screenshots`; review that artifact instead.

A visual task is not merge-ready until the screenshots have actually been opened and defects found in them have been corrected.
