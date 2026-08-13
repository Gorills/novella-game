import { CLUES, EVIDENCE_LINKS, SCENES } from "../data/story.js";

export function initialState() {
  return {
    sceneId: "menu",
    stress: 12,
    strain: 0,
    trustSofia: 48,
    egorInterest: 0,
    katyaGuard: 72,
    clues: [],
    hypotheses: [],
    evidenceLinks: [],
    flags: {},
    phoneOpen: false,
    deskOpen: false,
    dialogueResponse: null,
    catResponse: null,
    echoFocus: null,
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
    echo_focus: state.echoFocus,
    available_actions: agentActionCatalog(state),
    overlays: { phone: state.phoneOpen, desk: state.deskOpen },
    completed: state.completed
  };
}

function actionAllowed(state, action) {
  if (action.requires && !action.requires.every((id) => state.clues.includes(id))) return false;
  if (action.requiresFlag && !state.flags[action.requiresFlag]) return false;
  if (action.requiresFlags && !action.requiresFlags.every((flag) => Boolean(state.flags[flag]))) return false;
  if (action.unlessFlag && state.flags[action.unlessFlag]) return false;
  return true;
}

function sceneActions(state) {
  const scene = SCENES[state.sceneId];
  return (scene.actions || []).filter((action) => actionAllowed(state, action));
}

export function availableActions(state) {
  if (state.phoneOpen) {
    return [
      { id: "phone.reply.soft", label: "Ответить Софье спокойно" },
      { id: "phone.reply.sarcastic", label: "Спрятать тревогу за сарказмом" },
      { id: "phone.reply.partial", label: "Сказать только часть правды" },
      { id: "phone.close", label: "Закрыть телефон" }
    ];
  }

  if (state.deskOpen) {
    const actions = [];
    for (const link of Object.values(EVIDENCE_LINKS)) {
      const clueReady = state.clues.includes(link.a) && state.clues.includes(link.b);
      if (clueReady && !state.evidenceLinks.includes(link.id)) {
        actions.push({ id: `desk.link.${link.id}`, label: link.label });
      }
    }
    if (state.evidenceLinks.length >= 2 && !state.flags.thought_confirmed) {
      actions.push({ id: "desk.form_thought", label: "Сформулировать, что уже точно известно" });
    }
    actions.push({ id: "desk.close", label: "Закрыть рабочий стол" });
    return actions;
  }

  return sceneActions(state);
}

function addJournal(state, text) {
  state.journal = [text, ...state.journal].slice(0, 12);
}

function addClue(state, id) {
  if (!CLUES[id]) throw new Error(`Unknown clue: ${id}`);
  if (!state.clues.includes(id)) {
    state.clues.push(id);
    addJournal(state, `Наблюдение: ${CLUES[id].title}.`);
  }
}

function addHypothesis(state, text) {
  if (!state.hypotheses.includes(text)) {
    state.hypotheses.push(text);
    addJournal(state, "Катерина сформулировала первый личный вывод.");
  }
}

function go(state, id) {
  if (!SCENES[id]) throw new Error(`Unknown scene: ${id}`);
  state.sceneId = id;
  state.phoneOpen = false;
  state.deskOpen = false;
  state.dialogueResponse = null;
  state.catResponse = null;
  addJournal(state, `Сцена: ${SCENES[id].title}.`);
}

function validAction(state, actionId) {
  return availableActions(state).some((action) => action.id === actionId);
}

export function act(sourceState, actionId, payload = {}) {
  const state = structuredClone(sourceState);
  if (!validAction(state, actionId)) throw new Error(`Action not available: ${actionId}`);

  if (actionId === "game.start") {
    go(state, "studio");
  } else if (actionId === "game.restart") {
    return initialState();
  } else if (actionId === "studio.inspect_sketch") {
    state.flags.sketch_seen = true;
    addClue(state, "sketch_motif");
    addJournal(state, "Катерина замечает, что рука снова повторила один и тот же мотив.");
  } else if (actionId === "studio.close") {
    go(state, "walk");
  } else if (actionId === "walk.continue") {
    go(state, "cordon");
  } else if (actionId === "cordon.notice_symbol") {
    addClue(state, "cordon_symbol");
    state.flags.tattoo_flared = true;
    state.stress = Math.min(100, state.stress + 18);
    state.strain += 7;
    go(state, "echo");
    addJournal(state, "Резонанс начался сам — Катерина не активировала его сознательно.");
  } else if (actionId.startsWith("echo.focus.")) {
    const focus = actionId.slice("echo.focus.".length);
    const clueId = focus === "voice" ? "echo_voice" : focus === "hand" ? "echo_hand" : "echo_shape";
    state.echoFocus = focus;
    state.flags.echo_focused = true;
    addClue(state, clueId);
    state.strain += 4;
    addJournal(state, `В Эхе Катерина удержала одну деталь: ${CLUES[clueId].title.toLowerCase()}.`);
  } else if (actionId === "echo.break") {
    state.stress = Math.min(100, state.stress + 6);
    go(state, "egor");
  } else if (actionId === "egor.direct") {
    state.egorInterest += 7;
    state.katyaGuard = Math.max(0, state.katyaGuard - 2);
    state.flags.egor_exchanged = "direct";
    state.dialogueResponse = "«Потому что я видел такое раньше. Этого пока достаточно. И тебе действительно лучше уйти домой».";
    addJournal(state, "Катерина потребовала объяснений напрямую.");
  } else if (actionId === "egor.sarcastic") {
    state.egorInterest += 5;
    state.flags.egor_exchanged = "sarcastic";
    state.dialogueResponse = "Он едва заметно усмехается. «Тогда считай это бесплатным плохим советом. Не трогай светящуюся линию».";
    addJournal(state, "Катерина спрятала испуг за сарказмом.");
  } else if (actionId === "egor.guarded") {
    state.egorInterest += 3;
    state.katyaGuard = Math.min(100, state.katyaGuard + 4);
    state.flags.egor_exchanged = "guarded";
    state.dialogueResponse = "«Егор». Он не приближается. «И нет, я не жду, что ты мне поверишь. Просто не оставайся здесь одна».";
    addJournal(state, "Катерина не подтвердила незнакомцу ничего лишнего.");
  } else if (actionId === "scene.go_home") {
    go(state, "home");
  } else if (actionId === "home.feed_cat") {
    state.flags.home_settled = true;
    state.stress = Math.max(0, state.stress - 5);
    addJournal(state, "Катерина насыпала Кощею корм, поставила чайник и несколько минут позволила вечеру снова быть обычным.");
  } else if (actionId === "home.check_tattoo") {
    state.flags.cat_spoke = true;
    addClue(state, "tattoo_response");
    state.catResponse = "«Не трогай её.»";
    state.stress = Math.min(100, state.stress + 10);
    addJournal(state, "Кощей впервые заговорил человеческим голосом.");
  } else if (actionId === "koshchey.disbelief") {
    state.flags.cat_exchanged = "disbelief";
    state.catResponse = "Кощей медленно моргает зелёными глазами. «Да. Сказал. И, судя по твоему лицу, выбрал не лучший момент».";
    addJournal(state, "Катерина пытается проверить, не послышалось ли ей.");
  } else if (actionId === "koshchey.sarcastic") {
    state.flags.cat_exchanged = "sarcastic";
    state.catResponse = "«Рад, что чувство юмора пережило резонанс». Хвост нервно дёргается. «А теперь серьёзно: не трогай светящуюся линию».";
    addJournal(state, "Катерина отвечает говорящему коту сарказмом, потому что иначе придётся испугаться.");
  } else if (actionId === "koshchey.careful") {
    state.flags.cat_exchanged = "careful";
    state.catResponse = "Кощей остаётся на месте. «Сейчас — твой кот. Остальное слишком длинно. Но я не причина того, что случилось во дворе».";
    addJournal(state, "Катерина держит дистанцию и требует хотя бы минимальной правды.");
  } else if (actionId === "phone.open") {
    state.phoneOpen = true;
    addJournal(state, "Катерина открыла сообщение Софьи.");
  } else if (actionId === "phone.close") {
    state.phoneOpen = false;
  } else if (actionId === "phone.reply.soft") {
    state.trustSofia = Math.min(100, state.trustSofia + 6);
    state.flags.sofia_replied = "soft";
    state.phoneOpen = false;
    addClue(state, "sofia_photo");
    addJournal(state, "Катерина отвечает Софье спокойно, не втягивая её в опасность.");
  } else if (actionId === "phone.reply.sarcastic") {
    state.trustSofia = Math.max(0, state.trustSofia - 1);
    state.flags.sofia_replied = "sarcastic";
    state.phoneOpen = false;
    addClue(state, "sofia_photo");
    addJournal(state, "Катерина прячет тревогу за знакомым тоном.");
  } else if (actionId === "phone.reply.partial") {
    state.trustSofia = Math.min(100, state.trustSofia + 2);
    state.flags.sofia_replied = "partial";
    state.phoneOpen = false;
    addClue(state, "sofia_photo");
    addJournal(state, "Катерина признаётся только в том, что видела похожий знак по дороге домой.");
  } else if (actionId === "desk.open") {
    state.deskOpen = true;
    addJournal(state, "Катерина раскладывает свои материалы на рабочем столе.");
  } else if (actionId === "desk.close") {
    state.deskOpen = false;
  } else if (actionId.startsWith("desk.link.")) {
    const id = actionId.slice("desk.link.".length);
    const link = EVIDENCE_LINKS[id];
    if (!link) throw new Error(`Unknown evidence link: ${id}`);
    state.evidenceLinks.push(id);
    addJournal(state, `Связь на столе: ${link.result}`);
  } else if (actionId === "desk.form_thought") {
    addHypothesis(state, "Я рисовала этот знак раньше, хотя не знала, откуда он. И моя татуировка отреагировала на него как на что-то знакомое.");
    state.flags.thought_confirmed = true;
    state.deskOpen = false;
  } else if (actionId === "scene.finish") {
    go(state, "ending");
    state.completed = true;
  } else {
    throw new Error(`Unhandled action: ${actionId}`);
  }

  return state;
}

export function agentActionCatalog(state) {
  return availableActions(state).map((action) => ({ ...action }));
}
