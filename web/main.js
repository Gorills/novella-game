import { act, agentActionCatalog, initialState, observe } from "./core/game.js";
import { CLUES, PHONE_THREADS, SCENES, SEAL_SEQUENCE } from "./data/story.js";

let state = initialState();
const root = document.querySelector("#app");

const icons = {
  seal: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22"/><path d="M32 6v52M9 32h46M19 19l26 26M45 19 19 45"/><circle cx="32" cy="32" r="6"/></svg>`,
  pendant: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 12h16l-2 10 8 9-14 23-14-23 8-9z"/><circle cx="32" cy="31" r="6"/></svg>`,
  trace: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 46c10-2 10-18 20-18s10 17 18 14 5-16 10-24"/><circle cx="8" cy="46" r="3"/><circle cx="28" cy="28" r="3"/><circle cx="46" cy="42" r="3"/><circle cx="56" cy="18" r="3"/></svg>`
};

function setState(next) { state = next; render(); }
function dispatch(id, payload = {}) {
  try { setState(act(state, id, payload)); }
  catch (error) { console.error(error); toast(error.message); }
}
function toast(message) {
  const el = document.createElement("div"); el.className = "toast"; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), 2200);
}

function city() { return `<div class="cityline" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`; }
function katya() { return `<img class="character character-katya" src="./assets/katerina.webp" alt="Катерина" />`; }
function egor() { return `<img class="character character-egor" src="./assets/egor.webp" alt="Егор" />`; }
function sealMark() { return `<div class="seal-mark">${icons.seal}</div>`; }

function hotspots(scene) {
  return scene.hotspots.map((id, index) => {
    const clue = CLUES[id], found = state.clues.includes(id);
    return `<button class="hotspot hotspot-${index + 1} ${found ? "found" : ""}" data-action="inspect.${id}" ${found ? "disabled" : ""} aria-label="${clue.title}"><span class="hotspot-icon">${icons[clue.icon]}</span><span>${found ? "Найдено" : clue.title}</span></button>`;
  }).join("");
}

function sceneVisual(scene) {
  if (scene.id === "menu") return `<div class="visual menu-visual">${city()}<div class="moon"></div>${katya()}${sealMark()}<div class="rain"></div></div>`;
  if (scene.id === "apartment" || scene.id === "board") return `<div class="visual apartment-visual">${city()}<div class="window-glow"></div><div class="desk"></div>${katya()}<div class="rain"></div></div>`;
  if (scene.id === "street") return `<div class="visual street-visual">${city()}<div class="street-lights"></div>${katya()}<div class="rain heavy"></div><div class="wet-road"></div></div>`;
  if (scene.id === "crime") return `<div class="visual crime-visual"><div class="brick-wall"></div><div class="alley-glow"></div>${katya()}${hotspots(scene)}<div class="rain heavy"></div></div>`;
  if (scene.id === "echo") return `<div class="visual echo-visual"><div class="echo-shadow echo-one"></div><div class="echo-shadow echo-two"></div>${katya()}${sealMark()}<div class="echo-lines"></div></div>`;
  if (scene.id === "egor") return `<div class="visual egor-visual"><div class="alley-glow"></div>${egor()}<div class="egor-vignette"></div><div class="rain heavy"></div></div>`;
  if (scene.id === "ending") return `<div class="visual ending-visual">${city()}<div class="moon"></div>${katya()}${sealMark()}<div class="rain"></div></div>`;
  return `<div class="visual">${katya()}</div>`;
}

function actionButton(action) {
  return `<button class="choice ${action.kind ? `choice-${action.kind}` : ""}" data-action="${action.id}"><span>${action.label}</span><b>↗</b></button>`;
}

function renderMenu(scene) {
  return `<section class="menu-shell"><div class="menu-copy"><div class="eyebrow">${scene.kicker}</div><h1>Эхо<br><em>семи печатей</em></h1><p class="lede">${scene.copy[0]}</p><p class="lede muted">${scene.copy[1]}</p><div class="menu-actions"><button class="menu-start" data-action="game.start"><span>Начать пролог</span><b>→</b></button><button class="menu-secondary" data-overlay="about">О проекте</button></div><div class="menu-meta"><span>Пролог: След</span><span>15–20 минут</span><span>Детектив · Романтика · Мистика</span></div></div>${sceneVisual(scene)}</section>`;
}

function renderHeader(scene) {
  return `<header class="hud"><div class="hud-location"><span>${scene.location}</span><b>${scene.time}</b></div><div class="hud-center"><span class="chapter-dot"></span><b>Пролог: След</b></div><nav><button class="icon-btn" data-action="phone.open" aria-label="Телефон">⌁</button><button class="icon-btn" data-action="board.open" aria-label="Расследование">◇</button></nav></header>`;
}

function renderSidebar(scene) {
  const clueItems = state.clues.length ? state.clues.map((id) => `<li><span class="mini-icon">${icons[CLUES[id].icon]}</span><div><b>${CLUES[id].title}</b><small>${CLUES[id].reliability}</small></div></li>`).join("") : `<li class="empty">Улики появятся после осмотра места.</li>`;
  const hypothesis = state.hypotheses.length ? state.hypotheses[state.hypotheses.length - 1] : "Пока рано делать выводы.";
  return `<aside class="sidebar"><section class="side-card character-info"><div class="side-kicker">Катерина · 21</div><h3>${scene.id === "egor" ? "Настороженность" : "Состояние"}</h3><div class="meter-row"><span>Напряжение</span><b>${state.stress}%</b></div><div class="meter"><i style="width:${state.stress}%"></i></div><div class="meter-row"><span>Резонанс</span><b>${state.strain}%</b></div><div class="meter cool"><i style="width:${Math.min(100, state.strain)}%"></i></div><p>${state.flags.trace_seal_used ? "Печать Следа активна в памяти тела." : "Печати пока молчат — почти."}</p></section><section class="side-card"><div class="side-title"><h3>Улики</h3><span>${state.clues.length}/3</span></div><ul class="clue-mini-list">${clueItems}</ul></section><section class="side-card hypothesis-card"><div class="side-kicker">Рабочая гипотеза</div><p>${hypothesis}</p></section></aside>`;
}

function renderDialogue(scene) {
  const choices = !state.flags.egor_exchanged ? scene.choices.map(actionButton).join("") : "";
  const response = state.dialogueResponse ? `<div class="egor-response"><span>Егор</span><p>${state.dialogueResponse}</p></div>` : "";
  return `<div class="dialogue-block"><div class="speaker">${scene.speaker}</div><p class="dialogue-line">${scene.dialogue}</p>${response}<div class="choices">${choices}</div></div>`;
}

function renderStory(scene) {
  const actions = (scene.actions || []).filter((a) => {
    if (a.requires && !a.requires.every((id) => state.clues.includes(id))) return false;
    if (a.requiresFlag && !state.flags[a.requiresFlag]) return false;
    return true;
  });
  return `<div class="game-shell scene-${scene.mode}">${renderHeader(scene)}<div class="story-layout"><section class="scene-column">${sceneVisual(scene)}<div class="scene-caption"><span>${scene.location}</span><small>${scene.mode === "investigation" ? "Режим осмотра" : scene.mode === "echo" ? "Резонанс" : "Сцена"}</small></div></section><section class="narrative-column"><div class="eyebrow">${scene.mode === "dialogue" ? "Первая встреча" : scene.mode === "investigation" ? "Расследование" : scene.mode === "echo" ? "Печать Следа" : "История"}</div><h2>${scene.title}</h2><div class="narrative-copy">${scene.copy.map((p) => `<p>${p}</p>`).join("")}</div>${scene.mode === "dialogue" ? renderDialogue(scene) : ""}<div class="choices">${actions.map(actionButton).join("")}</div>${scene.id === "crime" ? `<div class="hint">Осмотри точки прямо в сцене. После обнаружения знака станет доступна Печать Следа.</div>` : ""}</section>${renderSidebar(scene)}</div></div>`;
}

function phoneOverlay() {
  if (!state.phoneOpen) return "";
  const thread = PHONE_THREADS[0];
  return `<div class="overlay" role="dialog" aria-modal="true"><section class="phone"><div class="phone-top"><span>23:14</span><b>Софья</b><button data-action="phone.close">×</button></div><div class="avatar-sofia">С</div><div class="messages">${thread.messages.map((m) => `<p>${m}</p>`).join("")}</div><div class="phone-photo"><div class="photo-seal">${icons.seal}</div><div><b>Фото из переулка</b><small>«Вот. Скажи, что я просто накручиваю себя»</small></div></div><div class="phone-replies"><button data-action="phone.reply.soft">«Я проверю. Ты только сама туда не ходи»</button><button data-action="phone.reply.sarcastic">«Отлично. Мои татуировки теперь ещё и городская легенда»</button><button data-action="phone.reply.silent">Не отвечать</button></div></section></div>`;
}

function sealOverlay() {
  if (!state.sealOpen) return "";
  const current = SEAL_SEQUENCE[state.sealProgress];
  return `<div class="overlay seal-overlay" role="dialog" aria-modal="true"><section class="seal-panel"><div class="eyebrow">Печать Следа · резонанс</div><h2>Удержи рисунок</h2><p>Проведи линию через узлы в том порядке, в котором их чувствует кожа. Ошибка увеличивает перегрузку.</p><div class="seal-game"><div class="seal-glyph">${icons.seal}</div>${[1,2,3,4,5].map((n) => `<button class="seal-node node-${n} ${SEAL_SEQUENCE.slice(0, state.sealProgress).includes(n) ? "done" : ""}" data-seal-node="${n}" aria-label="Узел ${n}">${n}</button>`).join("")}</div><div class="seal-status"><span>Линия ${state.sealProgress + 1}/${SEAL_SEQUENCE.length}</span><b>Ищи узел: ${current}</b></div><button class="cancel-link" data-action="seal.cancel">Прервать резонанс</button></section></div>`;
}

function boardOverlay() {
  if (!state.boardOpen) return "";
  const canForm = state.clues.includes("symbol_ground") && state.flags.trace_seal_used;
  return `<div class="overlay board-overlay" role="dialog" aria-modal="true"><section class="board-panel"><div class="board-head"><div><div class="eyebrow">Дело 01 · исчезновения</div><h2>Доска расследования</h2></div><button data-action="board.close">×</button></div><div class="board-canvas"><div class="board-note central"><b>Катерина</b><span>Почему знак совпадает с моими татуировками?</span></div>${state.clues.map((id, index) => `<div class="board-note clue-note note-${index+1}"><span class="note-icon">${icons[CLUES[id].icon]}</span><b>${CLUES[id].title}</b><small>${CLUES[id].short}</small></div>`).join("")}<div class="thread thread-a"></div><div class="thread thread-b"></div><div class="thread thread-c"></div></div><div class="board-footer"><div><b>${state.clues.length} улики</b><span>${canForm ? "Связь достаточно сильная для рабочей версии." : "Нужен знак и подтверждение через Эхо."}</span></div><button data-action="board.form_hypothesis" ${canForm ? "" : "disabled"}>Связать в гипотезу</button></div></section></div>`;
}

function aboutOverlay() {
  return `<div class="overlay about-overlay hidden" id="aboutOverlay"><section class="about-panel"><button class="close-about">×</button><div class="eyebrow">Vertical slice v0.1</div><h2>Не просто чтение текста</h2><p>Пролог проверяет основной цикл: персонаж → выбор → исследование → способность → улика → гипотеза → отношения.</p><p>Катерина использует исходный пользовательский референс без перерисовки. Каре — обязательный канон.</p></section></div>`;
}

function bindEvents() {
  root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => dispatch(button.dataset.action)));
  root.querySelectorAll("[data-seal-node]").forEach((button) => button.addEventListener("click", () => dispatch("seal.node", { node: Number(button.dataset.sealNode) })));
  root.querySelectorAll("[data-overlay='about']").forEach((button) => button.addEventListener("click", () => root.querySelector("#aboutOverlay").classList.remove("hidden")));
  root.querySelectorAll(".close-about").forEach((button) => button.addEventListener("click", () => root.querySelector("#aboutOverlay").classList.add("hidden")));
}

function render() {
  const scene = SCENES[state.sceneId];
  root.innerHTML = scene.mode === "menu" ? renderMenu(scene) : renderStory(scene);
  root.insertAdjacentHTML("beforeend", phoneOverlay() + sealOverlay() + boardOverlay() + aboutOverlay());
  bindEvents();
}

window.__NOVELLA__ = {
  observe: () => observe(state),
  actions: () => agentActionCatalog(state),
  act: (id, payload = {}) => { dispatch(id, payload); return observe(state); },
  reset: () => { state = initialState(); render(); return observe(state); },
  snapshot: () => structuredClone(state)
};

render();
