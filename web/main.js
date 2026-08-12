import { act, agentActionCatalog, initialState, observe } from "./core/game.js";
import { CLUES, EVIDENCE_LINKS, PHONE_THREADS, SCENES, SEAL_SEQUENCE } from "./data/story.js";

let state = initialState();
const root = document.querySelector("#app");
const ASSETS = { katerina: "./assets/katerina.webp", egor: "./assets/egor.webp" };

async function resolveAsset(name, partCount) {
  const direct = `./assets/${name}.webp`;
  try {
    const response = await fetch(direct, { method: "HEAD", cache: "no-store" });
    if (response.ok) return direct;
  } catch {}

  const parts = await Promise.all(Array.from({ length: partCount }, async (_, index) => {
    const file = `./assets/packed/${name}/${String(index).padStart(2, "0")}.b64`;
    const response = await fetch(file, { cache: "no-store" });
    if (!response.ok) throw new Error(`Missing packed asset chunk: ${file}`);
    return (await response.text()).replace(/\s+/g, "");
  }));
  return `data:image/webp;base64,${parts.join("")}`;
}

async function loadAssets() {
  [ASSETS.katerina, ASSETS.egor] = await Promise.all([
    resolveAsset("katerina", 5),
    resolveAsset("egor", 1)
  ]);
}

const icons = {
  seal: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22"/><path d="M32 6v52M9 32h46M19 19l26 26M45 19 19 45"/><circle cx="32" cy="32" r="6"/></svg>`,
  pendant: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 12h16l-2 10 8 9-14 23-14-23 8-9z"/><circle cx="32" cy="31" r="6"/></svg>`,
  trace: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 46c10-2 10-18 20-18s10 17 18 14 5-16 10-24"/><circle cx="8" cy="46" r="3"/><circle cx="28" cy="28" r="3"/><circle cx="46" cy="42" r="3"/><circle cx="56" cy="18" r="3"/></svg>`,
  phone: `<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.4"/><path d="M9.5 5h5M11 18.5h2"/></svg>`,
  board: `<svg viewBox="0 0 24 24"><path d="M4 5.5h16v14H4zM8 3h8v4H8z"/><path d="M7 11h10M7 15h7"/></svg>`
};

const sceneLabel = (scene) => scene.mode === "investigation" ? "Осмотр" : scene.mode === "echo" ? "Печать Следа" : scene.mode === "dialogue" ? "Встреча" : scene.mode === "board" ? "Возвращение" : "История";

function setState(next) {
  state = next;
  render();
}

function dispatch(id, payload = {}) {
  try {
    setState(act(state, id, payload));
  } catch (error) {
    console.error(error);
    toast(error.message);
  }
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}

function katya(extra = "") {
  return `<img class="character katya ${extra}" src="${ASSETS.katerina}" alt="Катерина" draggable="false"/>`;
}

function egor() {
  return `<div class="egor-frame"><img class="egor-art" src="${ASSETS.egor}" alt="Егор" draggable="false"/></div>`;
}

function skyline() {
  return `<div class="skyline" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i style="--n:${i}"></i>`).join("")}</div>`;
}

function rain() {
  return `<div class="rain" aria-hidden="true"></div><div class="rain rain-back" aria-hidden="true"></div>`;
}

function apartmentSet() {
  return `<div class="apartment-set" aria-hidden="true">
    <div class="window"><div class="window-city">${skyline()}</div></div>
    <div class="lamp"><i></i></div>
    <div class="shelf"></div>
    <div class="desk"><span class="sketch s1"></span><span class="sketch s2"></span><span class="cup"></span></div>
    <div class="floor-shadow"></div>
  </div>`;
}

function streetSet(crime = false) {
  return `<div class="street-set ${crime ? "crime" : ""}" aria-hidden="true">
    <div class="perspective left"></div><div class="perspective right"></div>
    <div class="void-sign">VOID</div><div class="street-lamp lamp-a"></div><div class="street-lamp lamp-b"></div>
    <div class="wet-ground"></div>${crime ? `<div class="police-tape"></div><div class="crime-mark">${icons.seal}</div>` : ""}
  </div>`;
}

function echoSet() {
  return `<div class="echo-set" aria-hidden="true">${streetSet(true)}<div class="echo-rift"></div><div class="afterimage one"></div><div class="afterimage two"></div><div class="afterimage three"></div><div class="echo-glyph">${icons.seal}</div></div>`;
}

function environment(scene) {
  if (scene.id === "menu" || scene.id === "ending") return `<div class="environment city-environment">${skyline()}<div class="moon"></div><div class="seal-ghost">${icons.seal}</div>${rain()}</div>`;
  if (scene.id === "apartment" || scene.id === "board") return `<div class="environment apartment-environment">${apartmentSet()}${rain()}</div>`;
  if (scene.id === "street") return `<div class="environment street-environment">${streetSet(false)}${rain()}</div>`;
  if (scene.id === "crime" || scene.id === "egor") return `<div class="environment crime-environment">${streetSet(true)}${rain()}</div>`;
  if (scene.id === "echo") return `<div class="environment echo-environment">${echoSet()}</div>`;
  return `<div class="environment"></div>`;
}

function header(scene) {
  return `<header class="game-header">
    <div class="location"><span>${scene.location}</span><b>${scene.time}</b></div>
    <div class="chapter"><i></i><span>Пролог · След</span></div>
    <nav>
      ${scene.id !== "menu" && scene.id !== "ending" ? `<button class="round" data-action="phone.open" aria-label="Телефон" ${state.phoneOpen || state.boardOpen || state.sealOpen ? "disabled" : ""}>${icons.phone}</button>` : ""}
      ${scene.id === "board" ? `<button class="round" data-action="board.open" aria-label="Доска улик" ${state.boardOpen ? "disabled" : ""}>${icons.board}</button>` : ""}
    </nav>
  </header>`;
}

function choice(action) {
  const tone = action.kind || action.tone || "quiet";
  return `<button class="choice choice-${tone}" data-action="${action.id}"><span>${action.label}</span><b>↗</b></button>`;
}

function storyPanel(scene) {
  const available = agentActionCatalog(state).filter((a) => !["phone.open", "board.open"].includes(a.id));
  const sceneActions = available.filter((a) => !a.id.startsWith("inspect.") && a.id !== "seal.node" && !a.id.startsWith("board."));
  return `<section class="story-panel ${scene.mode}">
    <div class="story-kicker">${sceneLabel(scene)}</div>
    <h2>${scene.title}</h2>
    <div class="story-copy">${scene.copy.map((p) => `<p>${p}</p>`).join("")}</div>
    ${scene.id === "apartment" && state.flags.sketch_inspected ? `<div class="micro-result">На одном из старых эскизов линии повторяют ритм знака из сообщения Софьи.</div>` : ""}
    ${scene.mode === "dialogue" ? dialogueBlock(scene) : ""}
    ${sceneActions.length ? `<div class="choices">${sceneActions.map(choice).join("")}</div>` : ""}
  </section>`;
}

function dialogueBlock(scene) {
  const response = state.dialogueResponse ? `<div class="egor-response"><span>Егор</span><p>${state.dialogueResponse}</p></div>` : `<div class="spoken"><span>Егор</span><p>${scene.dialogue}</p></div>`;
  return response;
}

function hotspots(scene) {
  return `<div class="hotspot-layer" aria-label="Точки осмотра">${scene.hotspots.map((id, index) => {
    const clue = CLUES[id];
    const found = state.clues.includes(id);
    return `<button class="hotspot h${index + 1} ${found ? "found" : ""}" data-action="inspect.${id}" ${found ? "disabled" : ""}>
      <span class="pulse"></span><span class="hotspot-icon">${icons[clue.icon]}</span><span class="hotspot-copy"><b>${found ? clue.title : "Осмотреть"}</b><small>${found ? "улика собрана" : clue.title}</small></span>
    </button>`;
  }).join("")}</div>`;
}

function investigationStatus(scene) {
  const found = scene.hotspots.filter((id) => state.clues.includes(id));
  const sealAvailable = found.includes("symbol_ground");
  return `<aside class="investigation-strip">
    <div><span>Осмотр</span><b>${found.length} / ${scene.hotspots.length}</b></div>
    <p>${found.length === 0 ? "Переулок кажется пустым только издалека." : found.length < 3 ? "Не спеши. Здесь ещё есть следы." : "Обычный осмотр закончен. Теперь можно рискнуть Эхом."}</p>
    ${sealAvailable ? `<button data-action="seal.begin">${icons.seal}<span>Печать Следа</span></button>` : `<small>Найди источник странной геометрии.</small>`}
  </aside>`;
}

function renderMenu(scene) {
  return `<main class="menu-screen">
    ${environment(scene)}
    <div class="menu-shade"></div>
    <div class="menu-hero">${katya("menu-katya")}</div>
    <section class="menu-copy">
      <div class="eyebrow">${scene.kicker}</div>
      <h1><span>Эхо</span><em>семи печатей</em></h1>
      <p>${scene.copy[0]}</p>
      <p class="muted">${scene.copy[1]}</p>
      <div class="menu-actions"><button class="start" data-action="game.start">Начать пролог <b>→</b></button></div>
      <div class="menu-meta"><span>Пролог: След</span><i></i><span>детектив · романтика · мистика</span></div>
    </section>
  </main>`;
}

function renderStory(scene) {
  const investigation = scene.mode === "investigation";
  const dialogue = scene.mode === "dialogue";
  return `<main class="game-screen scene-${scene.id} mode-${scene.mode}">
    ${environment(scene)}
    <div class="cinematic-vignette"></div>
    ${header(scene)}
    <div class="character-stage ${dialogue ? "dialogue-stage" : ""}">
      ${scene.id !== "echo" && scene.id !== "crime" && !dialogue ? katya(`pose-${scene.id}`) : ""}
      ${scene.id === "crime" ? katya("pose-crime") : ""}
      ${scene.id === "echo" ? katya("pose-echo") : ""}
      ${dialogue ? `${katya("pose-dialogue")}${egor()}` : ""}
    </div>
    ${investigation ? hotspots(scene) : ""}
    ${storyPanel(scene)}
    ${investigation ? investigationStatus(scene) : ""}
    <div class="scene-caption"><span>${scene.location}</span><b>${scene.time}</b></div>
  </main>`;
}

function phoneOverlay() {
  if (!state.phoneOpen) return "";
  const thread = PHONE_THREADS[0];
  return `<div class="overlay phone-overlay" role="dialog" aria-modal="true">
    <button class="overlay-dismiss" data-action="phone.close" aria-label="Закрыть телефон"></button>
    <section class="phone-device">
      <div class="phone-speaker"></div>
      <header><button data-action="phone.close">‹</button><div><b>${thread.name}</b><small>в сети</small></div><span>${thread.time}</span></header>
      <div class="phone-avatar">С</div>
      <div class="messages">${thread.messages.map((m, i) => `<div class="bubble ${i === 2 ? "important" : ""}">${m}<small>${i === 0 ? "23:14" : i === 1 ? "23:15" : "23:16"}</small></div>`).join("")}</div>
      <div class="phone-photo"><span>${icons.seal}</span><div><b>Фото из переулка</b><small>Знак у служебного входа Void</small></div></div>
      <div class="phone-replies">
        <button data-action="phone.reply.soft">«Я проверю. Ты сама туда не ходи»</button>
        <button data-action="phone.reply.sarcastic">«Отлично. Мои татуировки теперь городская легенда»</button>
        <button data-action="phone.reply.silent">Оставить без ответа</button>
      </div>
      <div class="phone-home"></div>
    </section>
  </div>`;
}

function sealOverlay() {
  if (!state.sealOpen) return "";
  const current = SEAL_SEQUENCE[state.sealProgress];
  return `<div class="overlay seal-overlay" role="dialog" aria-modal="true">
    <section class="seal-ritual">
      <div class="eyebrow">Печать Следа · резонанс</div>
      <h2>Удержи рисунок</h2>
      <p>Кожа помнит порядок лучше разума. Ошибка не закрывает путь — она увеличивает перегрузку.</p>
      <div class="seal-field"><div class="seal-core">${icons.seal}</div>${[1,2,3,4,5].map((n) => `<button class="seal-node node-${n} ${SEAL_SEQUENCE.slice(0, state.sealProgress).includes(n) ? "done" : ""}" data-seal-node="${n}">${n}</button>`).join("")}</div>
      <div class="ritual-status"><span>Линия ${state.sealProgress + 1} / ${SEAL_SEQUENCE.length}</span><b>Следующий узел: ${current}</b><small>Перегрузка: ${state.strain}</small></div>
      <button class="cancel" data-action="seal.cancel">Прервать резонанс</button>
    </section>
  </div>`;
}

function boardOverlay() {
  if (!state.boardOpen) return "";
  const links = state.evidenceLinks.map((id) => EVIDENCE_LINKS[id]);
  const actions = agentActionCatalog(state);
  const linkActions = actions.filter((a) => a.id.startsWith("board.link."));
  const canForm = actions.some((a) => a.id === "board.form_hypothesis");
  return `<div class="overlay board-overlay" role="dialog" aria-modal="true">
    <section class="evidence-board">
      <header><div><div class="eyebrow">Дело 01 · исчезновения</div><h2>Связи, а не список</h2></div><button data-action="board.close">×</button></header>
      <div class="board-workspace">
        <div class="board-canvas">
          <article class="note central"><span>Вопрос</span><b>Почему этот язык написан на моей коже?</b></article>
          ${state.clues.map((id, i) => `<article class="note clue n${i+1}"><span class="note-symbol">${icons[CLUES[id].icon]}</span><b>${CLUES[id].title}</b><p>${CLUES[id].short}</p></article>`).join("")}
          <article class="note echo-note"><span>Эхо</span><b>Знак вызывает отклик</b><p>Способность реагирует на геометрию, а не на предмет.</p></article>
          ${links.map((link, i) => `<div class="thread t${i+1}"></div>`).join("")}
        </div>
        <aside class="reasoning-panel">
          <div class="eyebrow">Проверить связь</div>
          ${linkActions.length ? `<div class="link-actions">${linkActions.map((a) => `<button data-action="${a.id}">${a.label}</button>`).join("")}</div>` : ""}
          <div class="connections">${links.length ? links.map((l) => `<article><b>${l.label}</b><p>${l.result}</p></article>`).join("") : `<p class="empty">Выбери связь между фактами. Игра не сформулирует вывод вместо тебя.</p>`}</div>
          <button class="hypothesis" data-action="board.form_hypothesis" ${canForm ? "" : "disabled"}>Сформулировать гипотезу</button>
          <small>${canForm ? "Две независимые связи поддерживают одну версию." : "Нужны как минимум две осмысленные связи и подтверждение Эхом."}</small>
        </aside>
      </div>
    </section>
  </div>`;
}

function bindEvents() {
  root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => dispatch(button.dataset.action)));
  root.querySelectorAll("[data-seal-node]").forEach((button) => button.addEventListener("click", () => dispatch("seal.node", { node: Number(button.dataset.sealNode) })));
}

function render() {
  const scene = SCENES[state.sceneId];
  root.innerHTML = scene.mode === "menu" ? renderMenu(scene) : renderStory(scene);
  root.insertAdjacentHTML("beforeend", phoneOverlay() + sealOverlay() + boardOverlay());
  bindEvents();
}

await loadAssets();

window.__NOVELLA__ = {
  observe: () => observe(state),
  actions: () => agentActionCatalog(state),
  act: (id, payload = {}) => { setState(act(state, id, payload)); return observe(state); },
  reset: () => { setState(initialState()); return observe(state); },
  snapshot: () => structuredClone(state)
};

render();
