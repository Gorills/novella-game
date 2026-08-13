import test from "node:test";
import assert from "node:assert/strict";
import { act, agentActionCatalog, initialState, observe } from "../core/game.js";

const A = (state, id, payload) => act(state, id, payload);
const has = (state, id) => agentActionCatalog(state).some((action) => action.id === id);

function reachEcho() {
  let s = initialState();
  s = A(s, "game.start");
  s = A(s, "studio.inspect_sketch");
  s = A(s, "studio.close");
  s = A(s, "walk.continue");
  s = A(s, "cordon.notice_symbol");
  return s;
}

function reachHome(egorTone = "direct", echoFocus = "voice") {
  let s = reachEcho();
  s = A(s, `echo.focus.${echoFocus}`);
  s = A(s, "echo.break");
  s = A(s, `egor.${egorTone}`);
  s = A(s, "scene.go_home");
  return s;
}

function settleHome(s) {
  return A(s, "home.feed_cat");
}

function reachDesk(reply = "partial") {
  let s = settleHome(reachHome());
  s = A(s, "home.check_tattoo");
  s = A(s, "koshchey.disbelief");
  s = A(s, "phone.open");
  s = A(s, `phone.reply.${reply}`);
  s = A(s, "desk.open");
  return s;
}

test("ordinary-life setup must happen before the route home", () => {
  let s = initialState();
  s = A(s, "game.start");
  assert.equal(s.sceneId, "studio");
  assert.equal(has(s, "studio.close"), false);
  assert.throws(() => A(s, "studio.close"), /Action not available/);

  s = A(s, "studio.inspect_sketch");
  assert.equal(s.clues.includes("sketch_motif"), true);
  assert.equal(has(s, "studio.close"), true);
});

test("Katerina reaches the supernatural contact by accident, not through investigation", () => {
  let s = initialState();
  s = A(s, "game.start");
  s = A(s, "studio.inspect_sketch");
  s = A(s, "studio.close");
  assert.equal(s.sceneId, "walk");
  assert.equal(has(s, "seal.begin"), false);
  assert.equal(has(s, "inspect.symbol_ground"), false);

  s = A(s, "walk.continue");
  assert.equal(s.sceneId, "cordon");
  s = A(s, "cordon.notice_symbol");
  assert.equal(s.sceneId, "echo");
  assert.equal(s.flags.tattoo_flared, true);
  assert.equal(s.clues.includes("cordon_symbol"), true);
  assert.equal(has(s, "seal.begin"), false);
});

test("first Echo keeps one fragment and only then releases Katerina", () => {
  let s = reachEcho();
  assert.equal(has(s, "echo.break"), false);
  assert.equal(has(s, "echo.focus.voice"), true);
  assert.equal(has(s, "echo.focus.hand"), true);
  assert.equal(has(s, "echo.focus.shape"), true);

  s = A(s, "echo.focus.hand");
  assert.equal(s.echoFocus, "hand");
  assert.equal(s.clues.includes("echo_hand"), true);
  assert.equal(has(s, "echo.focus.voice"), false);
  assert.equal(has(s, "echo.break"), true);

  s = A(s, "echo.break");
  assert.equal(s.sceneId, "egor");
});

test("Egor choices keep agency without granting him exposition authority", () => {
  let s = reachEcho();
  s = A(s, "echo.focus.shape");
  s = A(s, "echo.break");
  assert.equal(has(s, "egor.direct"), true);
  assert.equal(has(s, "egor.sarcastic"), true);
  assert.equal(has(s, "egor.guarded"), true);

  s = A(s, "egor.guarded");
  assert.equal(s.flags.egor_exchanged, "guarded");
  assert.equal(has(s, "scene.go_home"), true);
  assert.ok(s.katyaGuard > 72);
});

test("Koshchey stays an ordinary cat for a full home beat before speaking", () => {
  let s = reachHome();
  assert.equal(s.sceneId, "home");
  assert.equal(Boolean(s.flags.cat_spoke), false);
  assert.equal(has(s, "home.feed_cat"), true);
  assert.equal(has(s, "home.check_tattoo"), false);
  assert.equal(has(s, "phone.open"), false);

  s = A(s, "home.feed_cat");
  assert.equal(s.flags.home_settled, true);
  assert.equal(has(s, "home.feed_cat"), false);
  assert.equal(has(s, "home.check_tattoo"), true);
  assert.equal(Boolean(s.flags.cat_spoke), false);

  s = A(s, "home.check_tattoo");
  assert.equal(s.flags.cat_spoke, true);
  assert.equal(s.clues.includes("tattoo_response"), true);
  assert.equal(has(s, "koshchey.disbelief"), true);
  assert.equal(has(s, "phone.open"), false);

  s = A(s, "koshchey.sarcastic");
  assert.equal(s.flags.cat_exchanged, "sarcastic");
  assert.equal(has(s, "phone.open"), true);
});

test("Sofia message opens the personal reasoning workspace, not a police board", () => {
  let s = settleHome(reachHome("sarcastic", "voice"));
  s = A(s, "home.check_tattoo");
  s = A(s, "koshchey.careful");
  s = A(s, "phone.open");

  const phoneActions = agentActionCatalog(s).map((action) => action.id).sort();
  assert.deepEqual(phoneActions, ["phone.close", "phone.reply.partial", "phone.reply.sarcastic", "phone.reply.soft"].sort());

  s = A(s, "phone.reply.soft");
  assert.equal(s.clues.includes("sofia_photo"), true);
  assert.equal(has(s, "desk.open"), true);
  assert.equal(has(s, "scene.finish"), false);
});

test("complete prologue requires two personal connections before the first conclusion", () => {
  let s = reachDesk();
  assert.equal(has(s, "desk.form_thought"), false);

  s = A(s, "desk.link.sketch_symbol");
  assert.equal(has(s, "desk.form_thought"), false);

  s = A(s, "desk.link.symbol_tattoo");
  assert.equal(has(s, "desk.form_thought"), true);

  s = A(s, "desk.form_thought");
  assert.equal(s.flags.thought_confirmed, true);
  assert.equal(s.deskOpen, false);
  assert.equal(has(s, "scene.finish"), true);

  s = A(s, "scene.finish");
  assert.equal(s.sceneId, "ending");
  assert.equal(s.completed, true);
  assert.match(s.hypotheses[0], /Я рисовала этот знак раньше/);
});

test("agent observation hides future-author spoilers", () => {
  const raw = JSON.stringify(observe(initialState()));
  for (const word of ["Орлов", "седьмой печати", "истинной цели", "вампир", "почему он молчал"]) {
    assert.equal(raw.includes(word), false);
  }
});
