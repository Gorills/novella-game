import { act, agentActionCatalog, initialState, observe } from "./core/game.js";
import { CLUES, EVIDENCE_LINKS, PHONE_THREADS, SCENES } from "./data/story.js";

let state = initialState();
const root = document.querySelector("#app");

const icons = {
  phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9.5 5h5M10.8 18.5h2.4"/></svg>`,
  sketch: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="m7 16 3-7 3 5 2-8 2 10"/></svg>`,
  seal: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22"/><path d="M32 7v50M9 32h46M18 18l28 28M46 18 18 46"/><circle cx="32" cy="32" r="6"/></svg>`,
  table: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18v10H3zM6 18v3M18 18v3"/><path d="M7 5h10M9 3h6"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`
};

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
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 1800);
}

function sceneLabel(scene) {
  const labels = {
    story: "История",
    echo: "Эхо",
    dialogue: "Встреча",
    home: "Домой",
    ending: "Конец пролога"
  };
  return labels[scene.mode] || "Пролог";
}

function katya(extra = "") {
  return `<div class="katya-cutout ${extra}" role="img" aria-label="Катерина"></div>`;
}

function koshchey(extra = "") {
  return `<img class="koshchey ${extra}" src="./assets/koshchey.svg" alt="Кощей — чёрный кот с зелёными глазами" draggable="false"/>`;
}

function egor(extra = "") {
  return `<div class="egor-frame ${extra}"><img class="egor-art" src="./assets/egor.webp" alt="Егор" draggable="false"/></div>`;
}

function topChrome(scene) {
  const phoneAvailable = agentActionCatalog(state).some((a) => a.id === "phone.open");
  return `<header class="top-chrome">
    <div class="place"><span>${scene.location}</span><b>${scene.time}</b></div>
    <div class="chapter-mark"><i></i><span>Пролог · Чужая кожа</span></div>
    <div class="top-actions">
      ${phoneAvailable ? `<button class="phone-pill" data-action="phone.open">${icons.phone}<span>${state.flags.cat_exchanged && !state.flags.sofia_replied ? "Софья · новое сообщение" : "Телефон"}</span></button>` : ""}
    </div>
  </header>`;
}

function actionButton(action) {
  const tone = action.kind || action.tone || "quiet";
  return `<button class="story-action tone-${tone}" data-action="${action.id}">
    <span>${action.label}</span><b>${icons.arrow}</b>
  </button>`;
}

function storyActions(scene) {
  return agentActionCatalog(state).filter((action) => {
    if (["phone.open", "desk.open"].includes(action.id)) return false;
    if (action.id.startsWith("desk.")) return false;
    return true;
  });
}

function storyPanel(scene, options = {}) {
  const actions = storyActions(scene);
  const dialogue = options.dialogue || "";
  return `<section class="story-panel ${options.wide ? "wide" : ""}">
    <div class="story-overline">${sceneLabel(scene)}</div>
    <h2>${scene.title}</h2>
    <div class="story-copy">${scene.copy.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>
    ${dialogue}
    ${actions.length ? `<div class="story-actions">${actions.map(actionButton).join("")}</div>` : ""}
  </section>`;
}

function contextualGoal(scene) {
  if (scene.id === "studio" && !state.flags.sketch_seen) {
    return `<div class="goal-chip">${icons.sketch}<div><b>Ночь заканчивается</b><span>Проверь эскиз перед уходом</span></div></div>`;
  }
  if (scene.id === "cordon") {
    return `<div class="goal-chip warning">${icons.seal}<div><b>Ты остаёшься за лентой</b><span>Ничего не трогай — просто посмотри на знакомую форму</span></div></div>`;
  }
  if (scene.id === "home" && state.flags.cat_exchanged && !state.flags.sofia_replied) {
    return `<button class="goal-chip interactive" data-action="phone.open">${icons.phone}<div><b>Новое сообщение от Софьи</b><span>Телефон — полноценный игровой объект. Открыть сообщение</span></div></button>`;
  }
  if (scene.id === "home" && state.flags.sofia_replied && !state.flags.thought_confirmed) {
    return `<button class="goal-chip interactive desk" data-action="desk.open">${icons.table}<div><b>Разобраться, что вообще произошло</b><span>Разложить эскиз, фото и свои заметки на рабочем столе</span></div></button>`;
  }
  return "";
}

function sceneEnvironment(scene) {
  return `<div class="environment" aria-hidden="true"></div>`;
}

function studioProps() {
  return `<div class="studio-props" aria-hidden="true">
    <div class="studio-sign">INK / 23</div>
    <div class="flash-wall"><i></i><i></i><i></i><i></i></div>
    <div class="task-lamp"></div>
  </div>`;
}

function streetProps(scene) {
  if (scene.id === "walk") {
    return `<div class="street-props" aria-hidden="true"><div class="blue-light one"></div><div class="blue-light two"></div></div>`;
  }
  if (scene.id === "cordon") {
    return `<div class="street-props cordon-props" aria-hidden="true"><div class="police-tape">НЕ ПЕРЕСЕКАТЬ · POLICE LINE</div><div class="ground-symbol">${icons.seal}</div><div class="blue-light one"></div></div>`;
  }
  return "";
}

function echoVisual() {
  const focus = state.echoFocus;
  return `<div class="echo-visual" aria-hidden="true">
    <div class="echo-ring ring-a"></div><div class="echo-ring ring-b"></div>
    <div class="echo-fragment voice ${focus === "voice" ? "selected" : ""}">…не туда…</div>
    <div class="echo-fragment hand ${focus === "hand" ? "selected" : ""}"></div>
    <div class="echo-fragment shape ${focus === "shape" ? "selected" : ""}">${icons.seal}</div>
  </div>`;
}

function egorDialogue(scene) {
  const line = state.dialogueResponse || scene.dialogue;
  return `<div class="dialogue-line"><span>Егор</span><p>${line}</p></div>`;
}

function catDialogue() {
  if (!state.flags.cat_spoke) return "";
  return `<div class="cat-dialogue"><span>Кощей</span><p>${state.catResponse || "«Не трогай её.»"}</p></div>`;
}

function renderMenu(scene) {
  return `<main class="screen menu-screen scene-menu">
    ${sceneEnvironment(scene)}
    <div class="keyart-glass" aria-hidden="true"></div>
    <div class="menu-katya">${katya("menu-pose")}</div>
    <div class="menu-cat">${koshchey("menu-koshchey")}</div>
    <section class="menu-copy">
      <div class="menu-kicker">${scene.kicker}</div>
      <h1><span>Эхо</span><em>семи печатей</em></h1>
      <p>${scene.copy[0]}</p>
      <p class="muted">${scene.copy[1]}</p>
      <button class="start-button" data-action="game.start"><span>Начать пролог</span>${icons.arrow}</button>
      <div class="menu-foot"><span>Пролог: Чужая кожа</span><i></i><span>история · мистика · романтика</span></div>
    </section>
  </main>`;
}

function renderStudio(scene) {
  return `<main class="screen scene-studio">
    ${sceneEnvironment(scene)}${studioProps()}
    ${topChrome(scene)}
    <div class="character-stage right">${katya("story-pose")}</div>
    ${contextualGoal(scene)}
    ${storyPanel(scene)}
  </main>`;
}

function renderWalk(scene) {
  return `<main class="screen scene-${scene.id}">
    ${sceneEnvironment(scene)}${streetProps(scene)}
    ${topChrome(scene)}
    <div class="character-stage right subdued">${katya("walk-pose")}</div>
    ${contextualGoal(scene)}
    ${storyPanel(scene)}
  </main>`;
}

function renderEcho(scene) {
  return `<main class="screen scene-echo mode-echo">
    ${sceneEnvironment(scene)}${echoVisual()}
    ${topChrome(scene)}
    <div class="character-stage echo-katya">${katya("echo-pose")}</div>
    ${storyPanel(scene, { wide: true })}
  </main>`;
}

function renderEgor(scene) {
  return `<main class="screen scene-egor mode-dialogue">
    ${sceneEnvironment(scene)}
    ${topChrome(scene)}
    <div class="dialogue-stage">
      <div class="katya-side">${katya("dialogue-pose")}</div>
      ${egor("egor-side")}
    </div>
    ${storyPanel(scene, { wide: true, dialogue: egorDialogue(scene) })}
  </main>`;
}

function renderHome(scene) {
  const speaking = state.flags.cat_spoke ? "speaking" : "ordinary";
  return `<main class="screen scene-home mode-home">
    ${sceneEnvironment(scene)}
    ${topChrome(scene)}
    <div class="home-character">${katya("home-pose")}</div>
    <div class="home-cat-wrap ${speaking}">${koshchey("home-koshchey")}</div>
    ${contextualGoal(scene)}
    ${storyPanel(scene, { dialogue: catDialogue() })}
  </main>`;
}

function renderEnding(scene) {
  return `<main class="screen scene-ending">
    ${sceneEnvironment(scene)}
    <div class="ending-katya">${katya("ending-pose")}</div>
    <div class="ending-cat">${koshchey("ending-koshchey")}</div>
    <section class="ending-copy">
      <div class="story-overline">Конец пролога</div>
      <h2>${scene.title}</h2>
      ${scene.copy.map((paragraph) => `<p>${paragraph}</p>`).join("")}
      <div class="ending-question">Почему Катерина знала этот знак задолго до сегодняшней ночи?</div>
      ${storyActions(scene).map(actionButton).join("")}
    </section>
  </main>`;
}

function phoneOverlay() {
  if (!state.phoneOpen) return "";
  const thread = PHONE_THREADS[0];
  return `<div class="overlay phone-overlay" role="dialog" aria-modal="true" aria-label="Телефон Катерины">
    <button class="overlay-backdrop" data-action="phone.close" aria-label="Закрыть телефон"></button>
    <section class="phone-context">
      <div class="phone-context-icon">${icons.phone}</div>
      <h3>Софья не просит тебя лезть в дело</h3>
      <p>Она просто узнала на публичной фотографии рисунок, который постоянно видела в твоих эскизах.</p>
    </section>
    <section class="phone-device">
      <div class="phone-topbar"><span>23:41</span><i></i><b>LTE</b></div>
      <header>
        <div class="sofia-avatar">С</div>
        <div><b>${thread.name}</b><span>в сети</span></div>
        <button class="phone-close" data-action="phone.close" aria-label="Закрыть">${icons.close}</button>
      </header>
      <div class="message-scroll">
        ${thread.messages.map((message, index) => `<div class="message incoming"><p>${message}</p><small>${index === 0 ? "23:39" : index === 1 ? "23:40" : "23:41"}</small></div>`).join("")}
        <div class="shared-post">
          <div class="post-image"><span>${icons.seal}</span><i>городской канал · фото очевидца</i></div>
          <div><b>Проходной двор, Старый квартал</b><p>Пользователи обсуждают странный знак, который заметили до того, как двор закрыли.</p></div>
        </div>
      </div>
      <div class="reply-title">Как ответить Софье?</div>
      <div class="phone-replies">
        <button data-action="phone.reply.soft">«Да, похож. Я дома. Ты туда не ходи, ладно?»</button>
        <button data-action="phone.reply.sarcastic">«Супер. Мои каракули теперь городской фольклор.»</button>
        <button data-action="phone.reply.partial">«Я видела похожий знак по дороге домой. Потом объясню.»</button>
      </div>
      <div class="phone-homebar"></div>
    </section>
  </div>`;
}

function evidenceCard(id, className) {
  const clue = CLUES[id];
  if (!clue || !state.clues.includes(id)) return "";
  return `<article class="desk-card ${className}">
    <span>${clue.title}</span><p>${clue.short}</p>
  </article>`;
}

function deskOverlay() {
  if (!state.deskOpen) return "";
  const actions = agentActionCatalog(state);
  const linkActions = actions.filter((action) => action.id.startsWith("desk.link."));
  const canForm = actions.some((action) => action.id === "desk.form_thought");
  const links = state.evidenceLinks.map((id) => EVIDENCE_LINKS[id]);
  const echoId = state.echoFocus === "voice" ? "echo_voice" : state.echoFocus === "hand" ? "echo_hand" : "echo_shape";

  return `<div class="overlay desk-overlay" role="dialog" aria-modal="true" aria-label="Рабочий стол Катерины">
    <section class="desk-workspace">
      <header>
        <div><div class="story-overline">Не расследование. Попытка понять себя.</div><h2>Что из сегодняшнего я уже не могу объяснить?</h2></div>
        <button class="desk-close" data-action="desk.close" aria-label="Закрыть">${icons.close}</button>
      </header>
      <div class="desk-canvas">
        <div class="desk-question">Почему я знала этот знак раньше?</div>
        ${evidenceCard("sketch_motif", "card-sketch")}
        ${evidenceCard("cordon_symbol", "card-symbol")}
        ${evidenceCard("tattoo_response", "card-tattoo")}
        ${evidenceCard("sofia_photo", "card-photo")}
        ${evidenceCard(echoId, "card-echo")}
        ${links.map((link, index) => `<div class="connection-line line-${index + 1}"><span>${link.label}</span></div>`).join("")}
        <div class="desk-cat">${koshchey("desk-koshchey")}</div>
      </div>
      <aside class="desk-reasoning">
        <div class="reason-title">Связи, которые видит Катерина</div>
        <div class="reason-results">
          ${links.length ? links.map((link) => `<article><b>${link.label}</b><p>${link.result}</p></article>`).join("") : `<p class="empty">Выбери две связи. Игра не сформулирует вывод вместо тебя.</p>`}
        </div>
        <div class="reason-actions">
          ${linkActions.map((action) => `<button data-action="${action.id}">${action.label}</button>`).join("")}
        </div>
        <button class="form-thought" data-action="desk.form_thought" ${canForm ? "" : "disabled"}>Сформулировать, что уже точно известно</button>
        <small>${canForm ? "Две независимые связи поддерживают один личный вывод." : "Нужно минимум две осмысленные связи."}</small>
      </aside>
    </section>
  </div>`;
}

function renderScene(scene) {
  if (scene.id === "studio") return renderStudio(scene);
  if (["walk", "cordon"].includes(scene.id)) return renderWalk(scene);
  if (scene.id === "echo") return renderEcho(scene);
  if (scene.id === "egor") return renderEgor(scene);
  if (scene.id === "home") return renderHome(scene);
  if (scene.id === "ending") return renderEnding(scene);
  return `<main class="screen scene-${scene.id}">${sceneEnvironment(scene)}${topChrome(scene)}${storyPanel(scene)}</main>`;
}

function bindEvents() {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => dispatch(button.dataset.action));
  });
}

function render() {
  const scene = SCENES[state.sceneId];
  root.innerHTML = scene.mode === "menu" ? renderMenu(scene) : renderScene(scene);
  root.insertAdjacentHTML("beforeend", phoneOverlay() + deskOverlay());
  bindEvents();
}

window.__NOVELLA__ = {
  observe: () => observe(state),
  actions: () => agentActionCatalog(state),
  act: (id, payload = {}) => { setState(act(state, id, payload)); return observe(state); },
  reset: () => { setState(initialState()); return observe(state); },
  snapshot: () => structuredClone(state)
};

render();
