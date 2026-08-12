import test from "node:test";
import assert from "node:assert/strict";
import { act, agentActionCatalog, initialState, observe } from "../core/game.js";
const A = (s, id, p) => act(s, id, p);

test("complete prologue path", () => {
  let s = initialState();
  s=A(s,"game.start"); s=A(s,"phone.open"); s=A(s,"phone.reply.sarcastic"); s=A(s,"scene.go_street"); s=A(s,"street.touch_seal"); s=A(s,"scene.go_crime");
  for (const c of ["symbol_ground","pendant","drag_marks"]) s=A(s,`inspect.${c}`);
  s=A(s,"seal.begin"); for (const n of [2,4,1,5,3]) s=A(s,"seal.node",{node:n});
  s=A(s,"hypothesis.seed"); s=A(s,"scene.meet_egor"); s=A(s,"egor.direct"); s=A(s,"scene.go_home"); s=A(s,"board.open"); s=A(s,"board.form_hypothesis"); s=A(s,"scene.finish");
  assert.equal(s.sceneId,"ending"); assert.equal(s.completed,true);
});

test("wrong seal node fail-forwards", () => {
  let s=initialState(); s=A(s,"game.start"); s=A(s,"scene.go_street"); s=A(s,"scene.go_crime"); s=A(s,"inspect.symbol_ground"); s=A(s,"seal.begin"); s=A(s,"seal.node",{node:1});
  assert.equal(s.sealProgress,0); assert.equal(s.strain,5); assert.ok(agentActionCatalog(s).some(a=>a.id==="seal.node"));
});

test("Egor choices keep agency", () => {
  let s=initialState(); s.sceneId="egor"; s=A(s,"egor.cold"); assert.equal(s.flags.egor_exchanged,"cold"); assert.ok(agentActionCatalog(s).some(a=>a.id==="scene.go_home")); assert.ok(s.katyaGuard>74);
});

test("agent observation hides author spoilers", () => {
  const raw=JSON.stringify(observe(initialState())); for (const word of ["Орлов","седьмой печати","истинной цели","вампир"]) assert.equal(raw.includes(word),false);
});
