import { act, initialState, observe } from "../core/game.js";
let s=initialState(); const step=(id,p)=>{s=act(s,id,p);};
step("game.start"); step("phone.open"); step("phone.reply.sarcastic"); step("scene.go_street"); step("street.touch_seal"); step("scene.go_crime");
for(const c of ["symbol_ground","pendant","drag_marks"]) step(`inspect.${c}`);
step("seal.begin"); for(const n of [2,4,1,5,3]) step("seal.node",{node:n});
step("hypothesis.seed"); step("scene.meet_egor"); step("egor.direct"); step("scene.go_home"); step("board.open"); step("board.form_hypothesis"); step("scene.finish");
const result=observe(s); if(!result.completed) throw new Error("Agent smoke did not complete"); console.log(JSON.stringify(result,null,2));
