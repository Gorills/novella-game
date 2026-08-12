# Visual reboot implementation note

Текущий reboot заменяет dashboard-подачу vertical slice на полноэкранную VN-композицию, оставляя единый Game Core для human UI и Agent Driver.

## Реализовано

- полноэкранные presentation modes для menu/story/investigation/dialogue/Echo;
- phone, seal ritual и evidence board как отдельные overlays;
- ручное связывание улик до формирования гипотезы;
- скрытые relationship/state параметры вместо постоянных percentage HUD;
- безопасный `npm run visual-qa`: один Chromium, hard timeout, unique profile, `try/finally`, cleanup только собственного process group;
- CI screenshot artifact для обязательного человеческого/агентского visual review.

## Art status

`katerina.webp` остаётся locked canonical reference и материализуется из packed source при необходимости.

`egor.webp` в первом reboot — provisional slice portrait. Он не является долгосрочным locked romance reference sheet. Перед массовым производством эмоций/поз Егора нужен отдельный стабильный reference approval.

## Acceptance rule

Наличие этого документа не означает, что visual gate пройден. Merge допускается только после просмотра фактических screenshot artifacts и исправления найденных дефектов.
