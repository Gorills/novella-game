import { readFile, stat } from "node:fs/promises";
import { SCENES } from "../data/story.js";

const required = ["index.html", "styles.css", "cinematic-pass.css", "main.js", "core/game.js", "data/story.js", "assets/katerina.webp", "assets/egor.webp", "tools/visual-qa.mjs"];
for (const path of required) {
  const s = await stat(new URL(`../${path}`, import.meta.url));
  if (!s.size) throw new Error(`Empty: ${path}`);
}
for (const [id, scene] of Object.entries(SCENES)) {
  if (id !== scene.id || !scene.title || !scene.mode) throw new Error(`Bad scene ${id}`);
}
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
if (!html.includes('lang="ru"')) throw new Error("Russian locale missing");
if (!html.includes('cinematic-pass.css')) throw new Error("Cinematic presentation layer missing");
const main = await readFile(new URL("../main.js", import.meta.url), "utf8");
for (const api of ["observe", "actions", "act", "reset", "snapshot"]) {
  if (!main.includes(`${api}:`)) throw new Error(`Agent API missing: ${api}`);
}
console.log(`validated: ${Object.keys(SCENES).length} scenes, ${required.length} files`);
