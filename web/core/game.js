import { CLUES, EVIDENCE_LINKS, SCENES, SEAL_SEQUENCE } from "../data/story.js";

export function initialState() {
  return {
    sceneId: "menu",
    stress: 18,
    strain: 0,
    trustSofia: 46,
    egorInterest: 0,
    katyaGuard: 74,
    clues: [],
    hypotheses: [],
    evidenceLinks: [],
    flags: {},
    phoneOpen: false,
    boardOpen: false,
    sealOpen: false,
    sealProgress: 0,
    dialogueResponse: null,
    journal: ["Пролог готов к запуску."],
    completed: false
  };
}

export function observe(state) {
  const scene = SCENES[state.sceneId];
  return {
    scene: scene.id,
    location: scene.location,
    time: scene.time,
    mode: scene.mode,
    clues: [...state.clues],
    hypotheses: [...state.hypotheses],
    evidence_links: [...state.evidenceLinks],
    flags: { ...state.flags },
    stress: state.stress,
    strain: state.strain,
    available_actions: agentActionCatalog(state),
    overlays: { phone: state.phoneOpen, board: state.boardOpen, seal: state.sealOpen },
    completed: state.completed
  };
}

function sceneActions(state) {
  const scene = SCENES[state.sceneId];
  const list = [];
  if (scene.actions) list.push(...scene.actions);
  if (scene.choices && !state.flags.egor_exchanged) list.push(...scene.choices);
  if (scene.hotspots) {
    for (const id of scene.hotspots) {
      if (!state.clues.includes(id)) list.push({ id: `inspect.${id}`, label: `Осмотреть: ${CLUES[id].title}`, kind: "hotspot" });
    }
  }
  return list.filter((action) => {
    if (action.requires && !action.requires.every((id) => state.clues.includes(id))) return false;
    if (action.requiresFlag && !state.flags[action.requiresFlag]) return false;
    if (action.requiresFlags && !action.requiresFlags.every((flag) => Boolean(state.flags[flag]))) return false;
    return true;
  });
}

export function availableActions(state) {
  if (state.phoneOpen) {
    return [
      { id: "phone.reply.soft", label: "Ответить Софье мягко" },
      { id: "phone.reply.sarcastic", label: "Ответить Софье саркастично" },
      { id: "phone.reply.silent", label: "Не отвечать" },
      { id: "phone.close", label: "Закрыть телефон" }
    ];
  }
  if (state.sealOpen) {
    return [1, 2, 3, 4, 5].map((node) => ({ id: "seal.node", node, label: `Провести линию через узел ${node}` }))
      .concat({ id: "seal.cancel", label: "Прервать резонанс" });
  }
  if (state.boardOpen) {
    const actions = [];
    for (const link of Object.values(EVIDENCE_LINKS)) {
      const clueReady = state.clues.includes(link.a) && (!link.b || state.clues.includes(link.b));
      const flagReady = !link.requiresFlag || state.flags[link.requiresFlag];
      if (clueReady && flagReady && !state.evidenceLinks.includes(link.id)) {
        actions.push({ id: `board.link.${link.id}`, label: link.label });
      }
    }
    if (state.evidenceLinks.length >= 2 && state.flags.trace_seal_used && !state.flags.hypothesis_confirmed) {
      actions.push({ id: "board.form_hypothesis", label: "Сформулировать рабочую гипотезу" });
    }
    actions.push({ id: "board.close", label: "Закрыть доску" });
    return actions;
  }
  return sceneActions(state);
}

function addJournal(state, text) { state.journal = [text, ...state.journal].slice(0, 10); }
function addClue(state, id) {
  if (!CLUES[id]) throw new Error(`Unknown clue: ${id}`);
  if (!state.clues.includes(id)) {
    state.clues.push(id);
    addJournal(state, `Улика: ${CLUES[id].title}.`);
  }
}
function addHypothesis(state, text) {
  if (!state.hypotheses.includes(text)) {
    state.hypotheses.push(text);
    addJournal(state, "Сформулирована новая гипотеза.");
  }
}
function go(state, id) {
  if (!SCENES[id]) throw new Error(`Unknown scene: ${id}`);
  state.sceneId = id;
  state.phoneOpen = false;
  state.boardOpen = false;
  state.sealOpen = false;
  state.dialogueResponse = null;
  addJournal(state, `Сцена: ${SCENES[id].title}.`);
}

function validAction(state, actionId, payload) {
  return availableActions(state).some((a) => a.id === actionId && (actionId !== "seal.node" || a.node === Number(payload.node)));
}

export function act(sourceState, actionId, payload = {}) {
  const state = structuredClone(sourceState);
  if (!validAction(state, actionId, payload)) throw new Error(`Action not available: ${actionId}`);

  if (actionId === "game.start") go(state, "apartment");
  else if (actionId === "game.restart") return initialState();
  else if (actionId === "phone.open") { state.phoneOpen = true; addJournal(state, "Открыт телефон."); }
  else if (actionId === "phone.close") state.phoneOpen = false;
  else if (actionId === "phone.reply.soft") { state.trustSofia = Math.min(100, state.trustSofia + 8); state.flags.sofia_replied = "soft"; state.phoneOpen = false; addJournal(state, "Катерина ответила Софье мягче обычного."); }
  else if (actionId === "phone.reply.sarcastic") { state.trustSofia = Math.max(0, state.trustSofia - 2); state.flags.sofia_replied = "sarcastic"; state.phoneOpen = false; addJournal(state, "Катерина спрятала тревогу за сарказмом."); }
  else if (actionId === "phone.reply.silent") { state.flags.sofia_replied = "silent"; state.phoneOpen = false; addJournal(state, "Катерина оставила сообщение без ответа."); }
  else if (actionId === "apartment.inspect_sketch") { state.flags.sketch_inspected = true; addJournal(state, "В старом эскизе обнаружен знакомый ритм линий."); }
  else if (actionId === "scene.go_street") go(state, "street");
  else if (actionId === "street.touch_seal") { state.stress = Math.min(100, state.stress + 5); state.flags.seal_felt = true; addJournal(state, "Печать на руке отозвалась жаром."); }
  else if (actionId === "scene.go_crime") go(state, "crime");
  else if (actionId.startsWith("inspect.")) addClue(state, actionId.slice("inspect.".length));
  else if (actionId === "seal.begin") { state.sealOpen = true; state.sealProgress = 0; addJournal(state, "Катерина решила активировать Печать Следа."); }
  else if (actionId === "seal.cancel") { state.sealOpen = false; state.sealProgress = 0; }
  else if (actionId === "seal.node") {
    const node = Number(payload.node);
    const expected = SEAL_SEQUENCE[state.sealProgress];
    if (node === expected) {
      state.sealProgress += 1;
      if (state.sealProgress === SEAL_SEQUENCE.length) {
        state.sealOpen = false;
        state.strain += 16;
        state.stress = Math.min(100, state.stress + 12);
        state.flags.trace_seal_used = true;
        go(state, "echo");
        addJournal(state, "Печать Следа открыла Эхо места.");
      }
    } else {
      state.strain += 5;
      state.sealProgress = 0;
      addJournal(state, "Линия печати сорвалась — резонанс ударил болью.");
    }
  }
  else if (actionId === "hypothesis.seed") { state.flags.tattoo_connection_noted = true; addHypothesis(state, "Знак связан с узором на теле Катерины."); }
  else if (actionId === "scene.meet_egor") go(state, "egor");
  else if (actionId === "egor.direct") { state.egorInterest += 9; state.katyaGuard = Math.max(0, state.katyaGuard - 3); state.flags.egor_exchanged = "direct"; state.dialogueResponse = "«Потому что этот знак старше тебя. И потому что он не должен был проснуться»."; addJournal(state, "Катерина потребовала ответ напрямую."); }
  else if (actionId === "egor.sarcastic") { state.egorInterest += 6; state.flags.egor_exchanged = "sarcastic"; state.dialogueResponse = "«Обычно люди хотя бы представляются до того, как обвиняют меня в слежке»."; addJournal(state, "Катерина встретила предупреждение сарказмом."); }
  else if (actionId === "egor.cold") { state.egorInterest += 3; state.katyaGuard = Math.min(100, state.katyaGuard + 4); state.flags.egor_exchanged = "cold"; state.dialogueResponse = "Он выдерживает молчание первым. «Хорошо. Не доверяй мне. Просто не игнорируй знак»."; addJournal(state, "Катерина заставила Егора говорить первым."); }
  else if (actionId === "scene.go_home") go(state, "board");
  else if (actionId === "board.open") state.boardOpen = true;
  else if (actionId === "board.close") state.boardOpen = false;
  else if (actionId.startsWith("board.link.")) {
    const id = actionId.slice("board.link.".length);
    const link = EVIDENCE_LINKS[id];
    if (!link) throw new Error(`Unknown evidence link: ${id}`);
    state.evidenceLinks.push(id);
    addJournal(state, `Связь на доске: ${link.result}`);
  }
  else if (actionId === "board.form_hypothesis") {
    addHypothesis(state, "Исчезновения используют знак как механизм перехода; тот же язык встроен в татуировки Катерины.");
    state.flags.hypothesis_confirmed = true;
    state.boardOpen = false;
  }
  else if (actionId === "scene.finish") { go(state, "ending"); state.completed = true; }
  else throw new Error(`Unhandled action: ${actionId}`);

  return state;
}

export function agentActionCatalog(state) {
  return availableActions(state).map((a) => ({ ...a }));
}
