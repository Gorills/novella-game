import test from "node:test";
import assert from "node:assert/strict";
import { act, agentActionCatalog, initialState, observe } from "../core/game.js";
const A = (s, id, p) => act(s, id, p);
const has = (s, id) => agentActionCatalog(s).some((a) => a.id === id);

function leaveApartment(s, reply = "sarcastic") {
  s=A(s,"phone.open");
  s=A(s,`phone.reply.${reply}`);
  s=A(s,"apartment.inspect_sketch");
  s=A(s,"scene.go_street");
  return s;
}

function reachBoard() {
  let s = initialState();
  s=A(s,"game.start");
  s=leaveApartment(s);
  s=A(s,"street.touch_seal"); s=A(s,"scene.go_crime");
  for (const c of ["symbol_ground","pendant","drag_marks"]) s=A(s,`inspect.${c}`);
  s=A(s,"seal.begin"); for (const n of [2,4,1,5,3]) s=A(s,"seal.node",{node:n});
  s=A(s,"hypothesis.seed"); s=A(s,"scene.meet_egor"); s=A(s,"egor.direct"); s=A(s,"scene.go_home"); s=A(s,"board.open");
  return s;
}

test("apartment requires Sofia response and sketch before leaving", () => {
  let s=initialState();
  s=A(s,"game.start");
  assert.equal(has(s,"scene.go_street"),false);
  assert.throws(()=>A(s,"scene.go_street"),/Action not available/);

  s=A(s,"phone.open"); s=A(s,"phone.reply.soft");
  assert.equal(has(s,"scene.go_street"),false);

  s=A(s,"apartment.inspect_sketch");
  assert.equal(has(s,"scene.go_street"),true);
});

test("Trace Seal requires all three physical clues", () => {
  let s=initialState();
  s=A(s,"game.start"); s=leaveApartment(s,"silent"); s=A(s,"scene.go_crime");
  assert.equal(has(s,"seal.begin"),false);
  s=A(s,"inspect.symbol_ground");
  assert.equal(has(s,"seal.begin"),false);
  s=A(s,"inspect.pendant");
  assert.equal(has(s,"seal.begin"),false);
  s=A(s,"inspect.drag_marks");
  assert.equal(has(s,"seal.begin"),true);
});

test("complete prologue path requires evidence links", () => {
  let s = reachBoard();
  assert.equal(has(s,"board.form_hypothesis"), false);
  s=A(s,"board.link.symbol_drag"); s=A(s,"board.link.echo_symbol");
  assert.equal(has(s,"board.form_hypothesis"), true);
  s=A(s,"board.form_hypothesis"); s=A(s,"scene.finish");
  assert.equal(s.sceneId,"ending"); assert.equal(s.completed,true);
});

test("wrong seal node fail-forwards", () => {
  let s=initialState();
  s=A(s,"game.start"); s=leaveApartment(s); s=A(s,"scene.go_crime");
  for (const c of ["symbol_ground","pendant","drag_marks"]) s=A(s,`inspect.${c}`);
  s=A(s,"seal.begin"); s=A(s,"seal.node",{node:1});
  assert.equal(s.sealProgress,0); assert.equal(s.strain,5); assert.ok(has(s,"seal.node"));
});

test("Egor choices keep agency", () => {
  let s=initialState(); s.sceneId="egor"; s=A(s,"egor.cold"); assert.equal(s.flags.egor_exchanged,"cold"); assert.ok(has(s,"scene.go_home")); assert.ok(s.katyaGuard>74);
});

test("overlay actions use same available-actions contract", () => {
  let s=initialState(); s=A(s,"game.start"); s=A(s,"phone.open");
  const actions=agentActionCatalog(s).map(a=>a.id);
  assert.deepEqual(actions.sort(),["phone.close","phone.reply.sarcastic","phone.reply.silent","phone.reply.soft"].sort());
  assert.throws(()=>A(s,"scene.go_street"),/Action not available/);
});

test("agent observation hides author spoilers", () => {
  const raw=JSON.stringify(observe(initialState()));
  for (const word of ["Орлов","седьмой печати","истинной цели","вампир"]) assert.equal(raw.includes(word),false);
});
