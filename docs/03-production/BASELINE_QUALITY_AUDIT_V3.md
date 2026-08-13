# Baseline Quality Audit V3 — REJECT

Audit target: `main` at `bfae1e137d977740be5aa65f3317fbf189b9eaca`.

Evidence: full-size 1920×1080 acceptance screenshots, 1366×768 clickthrough screenshots, real UI playtest report (3 routes, 0 technical failures), story contract and Game Core.

Technical passability is not used as evidence of production quality.

## Scorecard

| Block | Score | Strongest evidence | Weakest point |
|---|---:|---|---|
| Character Presence | 2.0/5 | Katerina is technically visible on menu and story screens | the locked sprite is staged on a huge black presentation slab and has no emotional acting; she feels pasted onto the UI rather than present in the scene |
| Art Quality | 1.5/5 | night palette is directionally consistent | one blurred interior is reused for menu/studio/home/ending and one blurred street for walk/cordon/Egor; dark filters hide detail instead of creating composition |
| UI/UX | 2.0/5 | phone is physically large and readable | reasoning workspace is a hard fail: connector lines miss/overlap meaningful nodes, cross the central card and create visual noise; scene UI still reads as web panels over a background |
| Narrative Logic | 3.5/5 | Katerina now reaches the supernatural incident accidentally and stays behind the cordon | Egor appears at exactly the convenient moment with little grounding; the chain Echo → Egor → talking cat → Sofia photo → reasoning reveal still feels engineered rather than lived |
| Interest & Pacing | 2.5/5 | quiet home beat creates one useful decompression point | most scenes are single-CTA transitions; major reveals still arrive in a dense sequence and choices rarely produce memorable consequences |
| Gameplay Value | 2.0/5 | Echo focus and dialogue tones provide some agency | the dominant loop is click the only available CTA; workspace offers pre-authored connection buttons instead of letting the player discover a relationship |
| Tone & Atmosphere | 2.5/5 | dark romantic/mystical intent is readable | near-black presentation, repeated art and detached sprites flatten locations into the same mood instead of building place-specific atmosphere |
| Secondary Characters | 1.5/5 | Koshchey has a clear narrative function and Egor has a stable first-slice concept | Koshchey looks like an icon/mascot; Egor is a rectangular portrait from a visibly different art language and has almost no scene acting |

**Total: 17.5/40 — REJECT.**

Would I voluntarily play the next 10 minutes? **NO.**

## HARD FAILS

1. **Character presentation hard fail:** Katerina is visually isolated by large black stage/vignette blocks used to hide asset problems; the result is visibly artificial.
2. **Art hard fail:** production backgrounds are visibly soft/darkened and reused across unrelated locations instead of scene-specific production art.
3. **UI hard fail:** reasoning-board connector lines do not form clean node-to-node relationships and visually cross unrelated content.
4. **Secondary-character hard fail:** Koshchey is a simplistic mascot-like SVG in a game that otherwise targets cinematic urban gothic presentation.
5. **Gameplay quality fail:** a successful technical clickthrough does not change the fact that most of the slice is a one-button conveyor belt.

## Mandatory rework order

### P0 — visual foundation

- replace reused blurred raster environments with scene-specific crisp 1920×1080 art layers;
- remove black rectangular character staging around Katerina while preserving the exact locked reference;
- rebuild Koshchey into a credible black cat with green eyes;
- make menu/key art a deliberate composition rather than text + detached sprite;
- bring Egor into the same compositional language as Katerina even if his current portrait remains temporary.

### P0 — reasoning workspace

- delete decorative/misaligned freehand connector implementation;
- relationships must connect explicit visual anchors;
- the player must choose what to compare rather than click a pre-written conclusion disguised as a connection;
- no generic dashboard side panel.

### P1 — gameplay and pacing

- reduce single-CTA conveyor scenes;
- make at least one pre-supernatural ordinary-life interaction reveal Katerina as a person;
- make Echo focus materially affect later dialogue/context;
- make the first Egor exchange feel like an encounter, not an exposition popup;
- make Koshchey reveal emotionally land before the next information system opens;
- preserve at least one genuine quiet beat between major reveals.

### P1 — acceptance

The rework cannot merge until it reaches the thresholds in `PLAYTEST_RUBRIC.md`, contains no hard fail, and the reviewer can answer YES to: “Would I voluntarily play the next 10 minutes?”
