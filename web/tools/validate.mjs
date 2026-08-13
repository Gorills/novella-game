import { readFile, stat } from "node:fs/promises";
import { SCENES } from "../data/story.js";

const required = [
  "index.html",
  "styles.css",
  "art-pass.css",
  "main.js",
  "art-pass.js",
  "core/game.js",
  "data/story.js",
  "assets/katerina.webp",
  "assets/egor.webp",
  "assets/koshchey.svg",
  "tools/visual-qa.mjs",
  "tools/ui-playtest-v2.mjs"
];

for (const path of required) {
  const file = await stat(new URL(`../${path}`, import.meta.url));
  if (!file.size) throw new Error(`Empty: ${path}`);
}

for (const [id, scene] of Object.entries(SCENES)) {
  if (id !== scene.id || !scene.title || !scene.mode) throw new Error(`Bad scene ${id}`);
}

for (const id of ["menu", "studio", "walk", "cordon", "echo", "egor", "home", "ending"]) {
  if (!SCENES[id]) throw new Error(`Required rebuilt scene missing: ${id}`);
}

for (const forbidden of ["crime", "board", "apartment", "street"]) {
  if (SCENES[forbidden]) throw new Error(`Legacy rushed prologue scene still present: ${forbidden}`);
}

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
if (!html.includes('lang="ru"')) throw new Error("Russian locale missing");
if (!html.includes("Пролог: Чужая кожа")) throw new Error("Updated prologue title missing");

const main = await readFile(new URL("../main.js", import.meta.url), "utf8");
for (const api of ["observe", "actions", "act", "reset", "snapshot"]) {
  if (!main.includes(`${api}:`)) throw new Error(`Agent API missing: ${api}`);
}
if (!main.includes("koshchey.svg")) throw new Error("Koshchey asset not wired into UI");

const story = await readFile(new URL("../data/story.js", import.meta.url), "utf8");
for (const forbiddenAction of ["seal.begin", "scene.go_crime", "board.open", "inspect.symbol_ground"]) {
  if (story.includes(forbiddenAction)) throw new Error(`Legacy professional-investigation action remains in prologue: ${forbiddenAction}`);
}

console.log(`validated: ${Object.keys(SCENES).length} rebuilt scenes, ${required.length} required files`);
