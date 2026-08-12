import { CLUES, SCENES, SEAL_SEQUENCE } from "../data/story.js";

export function initialState() {
  return {
    sceneId: "menu", stress: 18, strain: 0, trustSofia: 46, egorInterest: 0, katyaGuard: 74,
    clues: [], hypotheses: [], flags: {}, phoneOpen: false, boardOpen: false, sealOpen: false,
    sealProgress: 0, dialogueResponse: null, journal: ["Пролог готов к запуску."], completed: false
  };
}

export function observe(state) {
  const scene = SCENES[state.sceneId];
  return {
    scene: scene.id, location: scene.location, time: scene.time, mode: scene.mode,
    clues: [...state.clues], hypotheses: [...state.hypotheses], flags: { ...state.flags },
    stress: state.stress, strain: state.strain,
    available_actions: availableActions(state).map((a) => a.id),
    overlays: { phone: state.phoneOpen, board: state.boardOpen, seal: state.sealOpen },
    completed: state.completed
  };
}

export function availableActions(state) {
  const scene = SCENES[state.sceneId];
  const list = [];
  if (scene.actions) list.push(...scene.actions);
  if (scene.choices && !state.flags.egor_exchanged) list.push(...scene.choices);
  if (scene.hotspots) {
    for (const id of scene.hotspots) if (!state.clues.includes(id)) list.push({ id: `inspect.${id}`, label: `Осмотреть: ${CLUES[id].title}`, kind: "hotspot" });
  }
  return list.filter((action) => {
    if (action.requires && !action.requires.every((id) => state.clues.includes(id))) return false;
    if (action.requiresFlag && !state.flags[action.requiresFlag]) return false;
    return true;
  });
}

function addJournal(state, text) { state.journal = [text, ...state.journal].slice(0, 8); }
function addClue(state, id) {
  if (!CLUES[id]) throw new Error(`Unknown clue: ${id}`);
  if (!state.clues.includes(id)) { state.clues.push(id); addJournal(state, `Улика: ${CLUES[id].title}.`); }
}
function addHypothesis(state, text) {
  if (!state.hypotheses.includes(text)) { state.hypotheses.push(text); addJournal(state, "Сформулирована новая гипотеза."); }
}
function go(state, id) {
  if (!SCENES[id]) throw new Error(`Unknown scene: ${id}`);
  state.sceneId = id; state.phoneOpen = false; state.boardOpen = false; state.sealOpen = false; state.dialogueResponse = null;
  addJournal(state, `Сцена: ${SCENES[id].title}.`);
}

export function act(sourceState, actionId, payload = {}) {
  const state = structuredClone(sourceState);
  const valid = availableActions(state).some((a) => a.id === actionId);
  const overlayAction = ["phone.open", "phone.close", "phone.reply.soft", "phone.reply.sarcastic", "phone.reply.silent", "board.open", "board.close", "board.form_hypothesis", "seal.node", "seal.cancel"].includes(actionId);
  if (!valid && !overlayAction) throw new Error(`Action not available: ${actionId}`);

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
    if (!state.sealOpen) throw new Error("Seal overlay is closed");
    const node = Number(payload.node); const expected = SEAL_SEQUENCE[state.sealProgress];
    if (node === expected) {
      state.sealProgress += 1;
      if (state.sealProgress === SEAL_SEQUENCE.length) {
        state.sealOpen = false; state.strain += 16; state.stress = Math.min(100, state.stress + 12); state.flags.trace_seal_used = true;
        go(state, "echo"); addJournal(state, "Печать Следа открыла Эхо места.");
      }
    } else { state.strain += 5; state.sealProgress = 0; addJournal(state, "Линия печати сорвалась — резонанс ударил болью."); }
  }
  else if (actionId === "hypothesis.seed") { state.flags.tattoo_connection_noted = true; addHypothesis(state, "Знак связан с узором на теле Катерины."); }
  else if (actionId === "scene.meet_egor") go(state, "egor");
  else if (actionId === "egor.direct") { state.egorInterest += 9; state.katyaGuard = Math.max(0, state.katyaGuard - 3); state.flags.egor_exchanged = "direct"; state.dialogueResponse = "«Потому что этот знак старше тебя. И потому что он не должен был проснуться»."; addJournal(state, "Катерина потребовала ответ напрямую."); }
  else if (actionId === "egor.sarcastic") { state.egorInterest += 6; state.flags.egor_exchanged = "sarcastic"; state.dialogueResponse = "«Обычно люди хотя бы представляются до того, как обвиняют меня в слежке»."; addJournal(state, "Катерина встретила предупреждение сарказмом."); }
  else if (actionId === "egor.cold") { state.egorInterest += 3; state.katyaGuard = Math.min(100, state.katyaGuard + 4); state.flags.egor_exchanged = "cold"; state.dialogueResponse = "Он выдерживает молчание первым. «Хорошо. Не доверяй мне. Просто не игнорируй знак»."; addJournal(state, "Катерина заставила Егора говорить первым."); }
  else if (actionId === "scene.go_home") go(state, "board");
  else if (actionId === "board.open") state.boardOpen = true;
  else if (actionId === "board.close") state.boardOpen = false;
  else if (actionId === "board.form_hypothesis") {
    if (!state.clues.includes("symbol_ground") || !state.flags.trace_seal_used) throw new Error("Not enough evidence for hypothesis");
    addHypothesis(state, "Исчезновения используют ту же систему знаков, которая встроена в татуировки Катерины.");
    state.flags.hypothesis_confirmed = true; state.boardOpen = false;
  }
  else if (actionId === "scene.finish") { go(state, "ending"); state.completed = true; }
  else throw new Error(`Unhandled action: ${actionId}`);
  return state;
}

export function agentActionCatalog(state) {
  const actions = availableActions(state).map((a) => ({ id: a.id, label: a.label }));
  if (state.phoneOpen) actions.push(
    { id: "phone.reply.soft", label: "Ответить Софье мягко" },
    { id: "phone.reply.sarcastic", label: "Ответить Софье саркастично" },
    { id: "phone.reply.silent", label: "Не отвечать" },
    { id: "phone.close", label: "Закрыть телефон" }
  );
  if (state.boardOpen) actions.push({ id: "board.form_hypothesis", label: "Связать улики в гипотезу" }, { id: "board.close", label: "Закрыть доску" });
  if (state.sealOpen) {
    for (let node = 1; node <= 5; node += 1) actions.push({ id: "seal.node", node, label: `Провести линию через узел ${node}` });
    actions.push({ id: "seal.cancel", label: "Прервать резонанс" });
  }
  return actions;
}
