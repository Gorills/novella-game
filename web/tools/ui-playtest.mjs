import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const WEB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(WEB_ROOT, ".qa", "ui-playtest");
const STEP_TIMEOUT_MS = 15000;
const RUN_TIMEOUT_MS = Number(process.env.UI_PLAYTEST_TIMEOUT_MS || 180000);
const CHROME_CANDIDATES = [process.env.CHROMIUM_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".webp":"image/webp", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml" };

const report = { started_at:new Date().toISOString(), scenarios:[], failures:[], steps:[] };
let activeScenario = "bootstrap";
class ScenarioAbort extends Error {}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chromiumPath() {
  const path = CHROME_CANDIDATES.find(existsSync);
  if (!path) throw new Error("Chromium not found. Set CHROMIUM_PATH.");
  return path;
}

function staticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const safe = normalize(relative).replace(/^(\.\.[/\\])+/, "");
      const path = join(WEB_ROOT, safe);
      if (!path.startsWith(WEB_ROOT)) throw new Error("invalid path");
      const body = await readFile(path);
      res.writeHead(200, { "content-type":MIME[extname(path)] || "application/octet-stream", "cache-control":"no-store" });
      res.end(body);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, port:server.address().port }));
  });
}

function launchChromium(userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(chromiumPath(), [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
      "--disable-background-networking", "--disable-component-update", "--disable-default-apps",
      "--disable-extensions", "--disable-features=Translate,MediaRouter", "--disable-sync",
      "--metrics-recording-only", "--no-first-run", "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`, "about:blank"
    ], { stdio:["ignore","ignore","pipe"], detached:process.platform !== "win32" });
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Chromium DevTools timeout. ${stderr.slice(-700)}`)), STEP_TIMEOUT_MS);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve({ child, wsUrl:match[1] }); }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => {
      if (!stderr.includes("DevTools listening")) {
        clearTimeout(timer);
        reject(new Error(`Chromium exited before playtest (${code}). ${stderr.slice(-700)}`));
      }
    });
  });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), STEP_TIMEOUT_MS);
      this.ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once:true });
      this.ws.addEventListener("error", (error) => { clearTimeout(timer); reject(error); }, { once:true });
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, STEP_TIMEOUT_MS);
      this.pending.set(id, { resolve:(value) => { clearTimeout(timer); resolve(value); }, reject:(error) => { clearTimeout(timer); reject(error); } });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise:true, returnByValue:true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result.value;
}

async function waitFor(cdp, sessionId, expression, label) {
  const started = Date.now();
  while (Date.now() - started < STEP_TIMEOUT_MS) {
    if (await evaluate(cdp, sessionId, expression)) return;
    await sleep(80);
  }
  throw new ScenarioAbort(`Timed out waiting for ${label}`);
}

async function setViewport(cdp, sessionId, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor:1, mobile:false }, sessionId);
}

async function loadGame(cdp, sessionId, url, width, height) {
  await setViewport(cdp, sessionId, width, height);
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitFor(cdp, sessionId, "document.readyState === 'complete' && Boolean(window.__NOVELLA__) && document.documentElement.dataset.productionArtReady === 'true'", "game boot");
  await sleep(220);
}

function fail(message, details = {}) { report.failures.push({ scenario:activeScenario, message, ...details }); console.error(`FAIL [${activeScenario}] ${message}`); }
function pass(message) { console.log(`PASS [${activeScenario}] ${message}`); }

async function actionCandidates(cdp, sessionId, action) {
  const selector = `[data-action="${action}"]`;
  return evaluate(cdp, sessionId, `(() => Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map((el,index)=>{
    const style=getComputedStyle(el), rect=el.getBoundingClientRect();
    const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
    const hit=rect.width>0&&rect.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight?document.elementFromPoint(x,y):null;
    return { index, tag:el.tagName, className:el.className||'', text:(el.textContent||el.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim(), disabled:Boolean(el.disabled), display:style.display, visibility:style.visibility, opacity:Number(style.opacity||1), rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}, inViewport:rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<innerHeight&&rect.left<innerWidth, hit:Boolean(hit&&(hit===el||el.contains(hit))) };
  }))()`);
}

function clickable(candidate) { return Boolean(candidate && !candidate.disabled && candidate.display !== "none" && candidate.visibility !== "hidden" && candidate.opacity > .02 && candidate.inViewport && candidate.hit); }

async function checkAction(cdp, sessionId, action, expected, label = action) {
  const candidates = await actionCandidates(cdp, sessionId, action);
  const available = candidates.some(clickable);
  available === expected ? pass(`${label}: ${expected ? "clickable" : "not clickable"}`) : fail(`${label}: expected ${expected ? "clickable" : "not clickable"}`, { action, candidates });
  return available;
}

async function checkActionSize(cdp, sessionId, action, minWidth, minHeight, label = action) {
  const candidates = await actionCandidates(cdp, sessionId, action);
  const candidate = candidates.find(clickable);
  if (!candidate) { fail(`${label}: no clickable candidate for size check`, { action, candidates }); return false; }
  const ok = candidate.rect.width >= minWidth && candidate.rect.height >= minHeight;
  ok ? pass(`${label}: ${Math.round(candidate.rect.width)}x${Math.round(candidate.rect.height)} meets target size`) : fail(`${label}: target too small`, { action, rect:candidate.rect, minWidth, minHeight });
  return ok;
}

async function clickAction(cdp, sessionId, action) {
  const candidates = await actionCandidates(cdp, sessionId, action);
  const candidate = candidates.find(clickable);
  if (!candidate) { fail(`Required UI action is not clickable: ${action}`, { action, candidates }); throw new ScenarioAbort(`Cannot continue: ${action}`); }
  const x=candidate.rect.x+candidate.rect.width/2, y=candidate.rect.y+candidate.rect.height/2;
  await cdp.send("Input.dispatchMouseEvent", { type:"mouseMoved", x, y }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type:"mousePressed", x, y, button:"left", clickCount:1 }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type:"mouseReleased", x, y, button:"left", clickCount:1 }, sessionId);
  report.steps.push({ scenario:activeScenario, action, text:candidate.text, rect:candidate.rect });
  console.log(`CLICK [${activeScenario}] ${action} :: ${candidate.text}`);
  await sleep(170);
}

async function checkText(cdp, sessionId, text, label = text) {
  const needle = text.toLocaleLowerCase("ru-RU");
  const visible = await evaluate(cdp, sessionId, `document.body.innerText.toLocaleLowerCase('ru-RU').includes(${JSON.stringify(needle)})`);
  visible ? pass(`text visible: ${label}`) : fail(`Expected visible text missing: ${label}`);
  return visible;
}

async function checkVisible(cdp, sessionId, selector, expected, label = selector) {
  const visible = await evaluate(cdp, sessionId, `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.02&&r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;})()`);
  visible === expected ? pass(`${label}: ${expected ? "visible" : "hidden"}`) : fail(`${label}: expected ${expected ? "visible" : "hidden"}`);
  return visible;
}

async function checkRect(cdp, sessionId, selector, predicate, label) {
  const rect = await evaluate(cdp, sessionId, `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  rect && predicate(rect) ? pass(`${label}: ${Math.round(rect.width)}x${Math.round(rect.height)}`) : fail(`${label}: unacceptable geometry`, { selector, rect });
  return rect;
}

async function screenshot(cdp, sessionId, name) {
  const result = await cdp.send("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false }, sessionId);
  const path = join(OUT, `${name}.png`);
  await writeFile(path, Buffer.from(result.data, "base64"));
  console.log(`SHOT [${activeScenario}] ${path}`);
}

async function scenario(cdp, sessionId, url, config) {
  activeScenario = config.name;
  const before = report.failures.length;
  console.log(`\n=== REAL UI PLAYTEST: ${config.name} (${config.width}x${config.height}) ===`);
  try {
    await loadGame(cdp, sessionId, url, config.width, config.height);

    await checkText(cdp, sessionId, "Эхо", "main menu title");
    await checkVisible(cdp, sessionId, ".menu-katya .katya-cutout", true, "Katerina on key art");
    await checkVisible(cdp, sessionId, ".menu-koshchey", true, "Koshchey on key art");
    await checkActionSize(cdp, sessionId, "game.start", 260, 52, "main CTA");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-01-menu`);
    await clickAction(cdp, sessionId, "game.start");

    await checkText(cdp, sessionId, "Последний эскиз на сегодня", "ordinary-life studio scene");
    await checkAction(cdp, sessionId, "studio.close", false, "leave studio before noticing sketch");
    await checkActionSize(cdp, sessionId, "studio.inspect_sketch", 260, 42, "studio primary interaction");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-02-studio`);
    await clickAction(cdp, sessionId, "studio.inspect_sketch");
    await checkAction(cdp, sessionId, "studio.close", true, "leave studio after quiet beat");
    await clickAction(cdp, sessionId, "studio.close");

    await checkText(cdp, sessionId, "Обычная дорога домой", "walk scene");
    await checkActionSize(cdp, sessionId, "walk.continue", 220, 42, "walk action");
    await clickAction(cdp, sessionId, "walk.continue");

    await checkText(cdp, sessionId, "Блик на мокром асфальте", "cordon scene");
    await checkAction(cdp, sessionId, "seal.begin", false, "no deliberate magic in prologue");
    await checkAction(cdp, sessionId, "inspect.symbol_ground", false, "no police-style hotspot investigation");
    await checkVisible(cdp, sessionId, ".police-tape", true, "visible safety boundary");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-03-cordon`);
    await clickAction(cdp, sessionId, "cordon.notice_symbol");

    await checkText(cdp, sessionId, "Мир на секунду становится чужим", "involuntary Echo scene");
    await checkAction(cdp, sessionId, "echo.break", false, "cannot leave Echo before focusing");
    for (const focus of ["voice","hand","shape"]) await checkAction(cdp, sessionId, `echo.focus.${focus}`, true, `Echo focus ${focus}`);
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-04-echo`);
    await clickAction(cdp, sessionId, `echo.focus.${config.echo}`);
    await checkAction(cdp, sessionId, "echo.break", true, "Echo release after one retained fragment");
    for (const focus of ["voice","hand","shape"]) await checkAction(cdp, sessionId, `echo.focus.${focus}`, false, `Echo focus ${focus} after choice`);
    await clickAction(cdp, sessionId, "echo.break");

    await checkText(cdp, sessionId, "слишком быстро", "Egor scene premise");
    for (const tone of ["direct","sarcastic","guarded"]) await checkAction(cdp, sessionId, `egor.${tone}`, true, `Egor choice ${tone}`);
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-05-egor`);
    await clickAction(cdp, sessionId, `egor.${config.egor}`);
    await checkVisible(cdp, sessionId, ".dialogue-line", true, "Egor response");
    await checkAction(cdp, sessionId, "scene.go_home", true, "leave after Egor exchange");
    await clickAction(cdp, sessionId, "scene.go_home");

    await checkText(cdp, sessionId, "Нормальность держится", "home decompression scene");
    await checkVisible(cdp, sessionId, ".home-koshchey", true, "ordinary Koshchey visible before speaking");
    await checkAction(cdp, sessionId, "home.feed_cat", true, "ordinary home beat available");
    await checkActionSize(cdp, sessionId, "home.feed_cat", 260, 42, "ordinary home beat target");
    await checkAction(cdp, sessionId, "home.check_tattoo", false, "Koshchey cannot speak before ordinary beat");
    await checkAction(cdp, sessionId, "phone.open", false, "phone waits for later story beat");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-06-home-ordinary`);
    await clickAction(cdp, sessionId, "home.feed_cat");
    await checkVisible(cdp, sessionId, ".micro-beat", true, "quiet home pause is visible");
    await checkText(cdp, sessionId, "Несколько обычных минут", "quiet home beat copy");
    await checkAction(cdp, sessionId, "home.check_tattoo", true, "tattoo check only after settling home");
    await checkAction(cdp, sessionId, "phone.open", false, "phone still waits for Koshchey exchange");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-06b-home-quiet-beat`);
    await clickAction(cdp, sessionId, "home.check_tattoo");
    await checkVisible(cdp, sessionId, ".cat-dialogue", true, "Koshchey speaking reveal");
    await checkText(cdp, sessionId, "Не трогай", "Koshchey first line");
    for (const tone of ["disbelief","sarcastic","careful"]) await checkAction(cdp, sessionId, `koshchey.${tone}`, true, `Koshchey reaction ${tone}`);
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-07-koshchey-speaks`);
    await clickAction(cdp, sessionId, `koshchey.${config.cat}`);

    await checkAction(cdp, sessionId, "phone.open", true, "discoverable Sofia message");
    await checkActionSize(cdp, sessionId, "phone.open", 150, 42, "first-use phone affordance");
    await clickAction(cdp, sessionId, "phone.open");
    await checkVisible(cdp, sessionId, ".phone-overlay", true, "phone overlay");
    await checkRect(cdp, sessionId, ".phone-device", (r) => r.width >= config.minPhoneWidth && r.height >= config.minPhoneHeight, "phone is a first-class readable object");
    for (const reply of ["soft","sarcastic","partial"]) await checkAction(cdp, sessionId, `phone.reply.${reply}`, true, `Sofia reply ${reply}`);
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-08-phone`);
    if (config.exerciseClose) {
      await clickAction(cdp, sessionId, "phone.close");
      await checkVisible(cdp, sessionId, ".phone-overlay", false, "phone closes through visible control");
      await clickAction(cdp, sessionId, "phone.open");
    }
    await clickAction(cdp, sessionId, `phone.reply.${config.sofia}`);
    await checkVisible(cdp, sessionId, ".phone-overlay", false, "phone closes after reply");

    await checkAction(cdp, sessionId, "desk.open", true, "reasoning workspace is offered after Sofia");
    await checkActionSize(cdp, sessionId, "desk.open", 220, 48, "reasoning workspace affordance");
    await clickAction(cdp, sessionId, "desk.open");
    await checkVisible(cdp, sessionId, ".desk-overlay", true, "home reasoning workspace");
    await checkRect(cdp, sessionId, ".desk-workspace", (r) => r.width >= config.width*.88 && r.height >= config.height*.86, "reasoning workspace fills the screen");
    await checkAction(cdp, sessionId, "desk.form_thought", false, "no instant correct-answer button");
    if (config.exerciseClose) {
      await clickAction(cdp, sessionId, "desk.close");
      await checkVisible(cdp, sessionId, ".desk-overlay", false, "reasoning workspace closes");
      await clickAction(cdp, sessionId, "desk.open");
    }
    await clickAction(cdp, sessionId, "desk.link.sketch_symbol");
    await checkAction(cdp, sessionId, "desk.form_thought", false, "one link is insufficient");
    await clickAction(cdp, sessionId, "desk.link.symbol_tattoo");
    await checkAction(cdp, sessionId, "desk.form_thought", true, "two personal links enable first conclusion");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-09-desk`);
    await clickAction(cdp, sessionId, "desk.form_thought");
    await checkVisible(cdp, sessionId, ".desk-overlay", false, "workspace closes after conclusion");
    await checkAction(cdp, sessionId, "scene.finish", true, "finish after personal conclusion");
    await clickAction(cdp, sessionId, "scene.finish");

    await checkText(cdp, sessionId, "Это не новый рисунок", "ending title");
    await checkText(cdp, sessionId, "Ты его вспоминаешь", "ending hook");
    await checkAction(cdp, sessionId, "game.restart", true, "restart at ending");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-10-ending`);
  } catch (error) {
    if (error instanceof ScenarioAbort) fail(error.message); else fail(`Unexpected scenario error: ${error.message}`);
  }

  report.scenarios.push({ name:config.name, viewport:`${config.width}x${config.height}`, echo:config.echo, egor:config.egor, cat:config.cat, sofia:config.sofia, failures:report.failures.length-before });
}

async function run() {
  await mkdir(OUT, { recursive:true });
  const { server, port } = await staticServer();
  const url = `http://127.0.0.1:${port}/`;
  const userDataDir = join(tmpdir(), `novella-ui-playtest-${process.pid}-${Date.now()}`);
  await mkdir(userDataDir, { recursive:true });
  let chrome, cdp;
  try {
    chrome = await launchChromium(userDataDir);
    cdp = new CDP(chrome.wsUrl);
    await cdp.ready();
    const { targetId } = await cdp.send("Target.createTarget", { url:"about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten:true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);

    await scenario(cdp, sessionId, url, { name:"voice-direct-disbelief-soft-1920", echo:"voice", egor:"direct", cat:"disbelief", sofia:"soft", width:1920, height:1080, minPhoneWidth:500, minPhoneHeight:720, capture:true, exerciseClose:true });
    await scenario(cdp, sessionId, url, { name:"shape-sarcastic-sarcastic-1920", echo:"shape", egor:"sarcastic", cat:"sarcastic", sofia:"sarcastic", width:1920, height:1080, minPhoneWidth:500, minPhoneHeight:720, capture:false, exerciseClose:false });
    await scenario(cdp, sessionId, url, { name:"hand-guarded-careful-partial-1366", echo:"hand", egor:"guarded", cat:"careful", sofia:"partial", width:1366, height:768, minPhoneWidth:440, minPhoneHeight:620, capture:true, exerciseClose:false });

    report.finished_at = new Date().toISOString();
    report.total_failures = report.failures.length;
    await writeFile(join(OUT, "report.json"), JSON.stringify(report,null,2));
    console.log(`\nui-playtest: ${report.scenarios.length} scenarios, ${report.failures.length} failure(s)`);
    if (report.failures.length) process.exitCode = 1;
  } finally {
    try { if (cdp) await cdp.send("Browser.close"); } catch {}
    try { cdp?.close(); } catch {}
    if (chrome?.child?.pid && chrome.child.exitCode === null) {
      try { process.platform === "win32" ? chrome.child.kill("SIGKILL") : process.kill(-chrome.child.pid,"SIGTERM"); } catch {}
      await sleep(800);
      if (chrome.child.exitCode === null) {
        try { process.platform === "win32" ? chrome.child.kill("SIGKILL") : process.kill(-chrome.child.pid,"SIGKILL"); } catch {}
      }
    }
    await new Promise((resolve) => server.close(resolve));
    await rm(userDataDir, { recursive:true, force:true });
  }
}

let timeoutHandle;
const timeout = new Promise((_,reject) => { timeoutHandle = setTimeout(() => reject(new Error(`ui-playtest exceeded ${RUN_TIMEOUT_MS}ms hard timeout`)), RUN_TIMEOUT_MS); });
try { await Promise.race([run(), timeout]); }
catch (error) { console.error(`ui-playtest failed: ${error.stack || error.message}`); process.exitCode = 1; }
finally { clearTimeout(timeoutHandle); }