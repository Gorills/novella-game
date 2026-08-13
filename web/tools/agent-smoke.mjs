import { act, initialState, observe } from "../core/game.js";

let s = initialState();
const step = (id, payload) => { s = act(s, id, payload); };

step("game.start");
step("studio.inspect_sketch");
step("studio.close");
step("walk.continue");
step("cordon.notice_symbol");
step("echo.focus.voice");
step("echo.break");
step("egor.direct");
step("scene.go_home");
step("home.feed_cat");
step("home.check_tattoo");
step("koshchey.disbelief");
step("phone.open");
step("phone.reply.partial");
step("desk.open");
step("desk.link.sketch_symbol");
step("desk.link.symbol_tattoo");
step("desk.form_thought");
step("scene.finish");

const result = observe(s);
if (!result.completed) throw new Error("Agent smoke did not complete rebuilt prologue");
if (result.evidence_links.length < 2) throw new Error("Personal reasoning links were bypassed");
if (!result.flags.home_settled) throw new Error("Quiet home beat was bypassed");
if (!result.flags.cat_spoke) throw new Error("Koshchey reveal was bypassed");
if (!result.flags.tattoo_flared) throw new Error("Accidental supernatural contact was bypassed");
if (result.flags.trace_seal_used) throw new Error("Prologue must not contain deliberate Trace Seal use");

console.log(JSON.stringify(result, null, 2));
