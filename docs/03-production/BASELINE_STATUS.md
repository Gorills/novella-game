# Baseline status

## Current playable

**Vertical slice:** `Пролог: След`.

Implemented flow:

1. main menu;
2. Катерина дома;
3. phone interaction with Софья;
4. route to Void;
5. crime-scene inspection;
6. three clues;
7. interactive Trace Seal sequence;
8. Echo fragment;
9. first meeting with Егор and three in-character response tones;
10. investigation board;
11. first confirmed working hypothesis;
12. prologue ending hook.

## Shared game core

Human UI and agent interface use the same `web/core/game.js` state transitions.

Agent API is exposed as `window.__NOVELLA__`:

- `observe()`;
- `actions()`;
- `act()`;
- `reset()`;
- `snapshot()`.

## Verification completed for baseline

- unit tests: 4/4 pass;
- static validation: pass;
- full agent smoke: pass through `ending`, `completed=true`;
- browser playthrough: pass without page/console errors;
- visual review: 1920×1080 and 1366×768;
- reviewed states: menu, phone, crime scene, seal game, Egor, board, ending;
- one visual defect in the initial Egor composition was found during screenshot review and fixed before baseline acceptance.

## Canon lock

`web/assets/katerina.webp` is the project visual reference derived directly from the user-provided image. **Катерина всегда с тёмно-красным каре.** Earlier long-hair text is explicitly obsolete.

## Next production target

Do not immediately inflate chapter count. Next work should deepen Chapter 1 around this proven loop: better location art, character reference packs, more environmental interaction, richer evidence contradictions, and longer relationship beats while keeping the same quality gate.

Read `AGENTS.md` and `docs/03-production/QUALITY_GATE.md` before modifying the baseline.
