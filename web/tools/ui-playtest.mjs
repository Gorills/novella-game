import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const WEB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(WEB_ROOT, ".qa", "ui-playtest");
const RUN_TIMEOUT_MS = Number(process.env.UI_PLAYTEST_TIMEOUT_MS || 180000);
const STEP_TIMEOUT_MS = 15000;
const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable"
].filter(Boolean);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const report = { started_at: new Date().toISOString(), scenarios: [], failures: [], steps: [] };
let activeScenario = "bootstrap";

class ScenarioAbort extends Error {}

function chromiumPath() {
  const found = CANDIDATES.find(existsSync);
  if (!found) throw new Error("Chromium not found. Set CHROMIUM_PATH.");
  return found;
}

function staticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const requested = new URL(req.url || "/", "http://127.0.0.1").pathname;
      const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
      const safe = normalize(relative).replace(/^(\.\.[/\\])+/, "");
      const path = join(WEB_ROOT, safe);
      if (!path.startsWith(WEB_ROOT)) throw new Error("bad path");
      const body = await readFile(path);
      res.writeHead(200, {
        "content-type": mime[extname(path)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function launchChromium(userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(chromiumPath(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-features=Translate,MediaRouter",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"], detached: process.platform !== "win32" });

    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Chromium did not expose DevTools in time. ${stderr.slice(-800)}`)), STEP_TIMEOUT_MS);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ child, wsUrl: match[1] });
      }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => {
      if (!stderr.includes("DevTools listening")) {
        clearTimeout(timer);
        reject(new Error(`Chromium exited before playtest started (${code}). ${stderr.slice(-800)}`));
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
      const msg = JSON.parse(event.data);
      if (!msg.id) return;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      msg.error ? pending.reject(new Error(msg.error.message)) : pending.resolve(msg.result);
    });
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), STEP_TIMEOUT_MS);
      this.ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener("error", (error) => { clearTimeout(timer); reject(error); }, { once: true });
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, STEP_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result.value;
}

async function waitFor(cdp, sessionId, expression, label, timeoutMs = STEP_TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, sessionId, expression)) return;
    await sleep(80);
  }
  throw new ScenarioAbort(`Timed out waiting for ${label}`);
}

async function setViewport(cdp, sessionId, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false
  }, sessionId);
}

async function loadGame(cdp, sessionId, url, width, height) {
  await setViewport(cdp, sessionId, width, height);
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitFor(
    cdp,
    sessionId,
    "document.readyState === 'complete' && Boolean(document.querySelector('#app')) && document.documentElement.dataset.productionArtReady === 'true'",
    "game boot"
  );
  await sleep(180);
}

function fail(message, details = {}) {
  const entry = { scenario: activeScenario, message, ...details };
  report.failures.push(entry);
  console.error(`FAIL [${activeScenario}] ${message}`);
}

function pass(message) {
  console.log(`PASS [${activeScenario}] ${message}`);
}

async function actionInfo(cdp, sessionId, action) {
  const selector = `[data-action="${action}"]`;
  return evaluate(cdp, sessionId, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
      disabled: Boolean(el.disabled),
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity || 1),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      inViewport: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
      hit: Boolean(hit && (hit === el || el.contains(hit)))
    };
  })()`);
}

function isClickable(info) {
  return Boolean(info && !info.disabled && info.display !== "none" && info.visibility !== "hidden" && info.opacity > 0.02 && info.inViewport && info.hit);
}

async function checkAction(cdp, sessionId, action, expected, label = action) {
  const info = await actionInfo(cdp, sessionId, action);
  const clickable = isClickable(info);
  if (clickable === expected) pass(`${label}: ${expected ? "clickable" : "not clickable"}`);
  else fail(`${label}: expected ${expected ? "clickable" : "not clickable"}`, { action, info });
  return info;
}

async function mustClickAction(cdp, sessionId, action) {
  const info = await actionInfo(cdp, sessionId, action);
  if (!isClickable(info)) {
    fail(`Required UI action is not clickable: ${action}`, { action, info });
    throw new ScenarioAbort(`Cannot continue: ${action}`);
  }
  const x = info.rect.x + info.rect.width / 2;
  const y = info.rect.y + info.rect.height / 2;
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, sessionId);
  report.steps.push({ scenario: activeScenario, action, text: info.text, rect: info.rect });
  console.log(`CLICK [${activeScenario}] ${action} :: ${info.text}`);
  await sleep(150);
}

async function sealNodeInfo(cdp, sessionId, node) {
  const selector = `[data-seal-node="${node}"]`;
  return evaluate(cdp, sessionId, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      text: (el.textContent || '').trim(),
      disabled: Boolean(el.disabled),
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity || 1),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      inViewport: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
      hit: Boolean(hit && (hit === el || el.contains(hit)))
    };
  })()`);
}

async function mustClickSealNode(cdp, sessionId, node) {
  const info = await sealNodeInfo(cdp, sessionId, node);
  if (!isClickable(info)) {
    fail(`Seal node ${node} is not clickable`, { node, info });
    throw new ScenarioAbort(`Cannot continue seal at node ${node}`);
  }
  const x = info.rect.x + info.rect.width / 2;
  const y = info.rect.y + info.rect.height / 2;
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, sessionId);
  report.steps.push({ scenario: activeScenario, seal_node: node, rect: info.rect });
  console.log(`CLICK [${activeScenario}] seal node ${node}`);
  await sleep(120);
}

async function checkText(cdp, sessionId, text, label = text) {
  const found = await evaluate(cdp, sessionId, `document.body.innerText.includes(${JSON.stringify(text)})`);
  if (found) pass(`text visible: ${label}`);
  else fail(`Expected visible text missing: ${label}`);
  return found;
}

async function checkSelector(cdp, sessionId, selector, expected, label = selector) {
  const visible = await evaluate(cdp, sessionId, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .02 && r.width > 0 && r.height > 0;
  })()`);
  if (visible === expected) pass(`${label}: ${expected ? "visible" : "hidden"}`);
  else fail(`${label}: expected ${expected ? "visible" : "hidden"}`);
  return visible;
}

async function screenshot(cdp, sessionId, name) {
  const data = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  }, sessionId);
  const path = join(OUT, `${name}.png`);
  await writeFile(path, Buffer.from(data.data, "base64"));
  console.log(`SHOT [${activeScenario}] ${path}`);
}

async function playScenario(cdp, sessionId, url, config) {
  activeScenario = config.name;
  const startFailures = report.failures.length;
  console.log(`\n=== UI PLAYTEST: ${config.name} (${config.width}x${config.height}) ===`);
  try {
    await loadGame(cdp, sessionId, url, config.width, config.height);
    await checkText(cdp, sessionId, "Эхо", "main menu title");
    await checkAction(cdp, sessionId, "game.start", true, "start button");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-01-menu`);
    await mustClickAction(cdp, sessionId, "game.start");
    await checkText(cdp, sessionId, "Тишина перед шумом", "apartment scene");

    // Required narrative order: the apartment should not let the player skip
    // both Sofia and the sketch and jump straight to Void.
    await checkAction(cdp, sessionId, "scene.go_street", false, "leave apartment before Sofia/sketch");

    await mustClickAction(cdp, sessionId, "phone.open");
    await checkSelector(cdp, sessionId, ".phone-overlay", true, "phone overlay");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-02-phone`);

    if (config.testPhoneClose) {
      await mustClickAction(cdp, sessionId, "phone.close");
      await checkSelector(cdp, sessionId, ".phone-overlay", false, "phone closes from UI");
      await mustClickAction(cdp, sessionId, "phone.open");
    }
    await mustClickAction(cdp, sessionId, `phone.reply.${config.sofia}`);
    await checkSelector(cdp, sessionId, ".phone-overlay", false, "phone closes after reply");

    await mustClickAction(cdp, sessionId, "apartment.inspect_sketch");
    await checkText(cdp, sessionId, "старых эскизов", "sketch inspection feedback");
    await checkAction(cdp, sessionId, "scene.go_street", true, "leave apartment after required beats");
    await mustClickAction(cdp, sessionId, "scene.go_street");
    await checkText(cdp, sessionId, "Город смотрит в ответ", "street scene");
    await mustClickAction(cdp, sessionId, "street.touch_seal");
    await mustClickAction(cdp, sessionId, "scene.go_crime");
    await checkText(cdp, sessionId, "Место, где след обрывается", "crime scene");

    // Investigation should require all three physical clues before magic.
    await checkAction(cdp, sessionId, "seal.begin", false, "Trace Seal before any clue");
    await mustClickAction(cdp, sessionId, "inspect.symbol_ground");
    await checkAction(cdp, sessionId, "inspect.symbol_ground", false, "found hotspot cannot be clicked again");
    await checkAction(cdp, sessionId, "seal.begin", false, "Trace Seal after one clue");
    await mustClickAction(cdp, sessionId, "inspect.pendant");
    await checkAction(cdp, sessionId, "seal.begin", false, "Trace Seal after two clues");
    await mustClickAction(cdp, sessionId, "inspect.drag_marks");
    await checkAction(cdp, sessionId, "seal.begin", true, "Trace Seal after three clues");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-03-investigation-complete`);

    await mustClickAction(cdp, sessionId, "seal.begin");
    await checkSelector(cdp, sessionId, ".seal-overlay", true, "seal overlay");
    if (config.testSealCancel) {
      await mustClickAction(cdp, sessionId, "seal.cancel");
      await checkSelector(cdp, sessionId, ".seal-overlay", false, "seal cancel closes ritual");
      await mustClickAction(cdp, sessionId, "seal.begin");
    }
    if (config.testWrongSeal) {
      await mustClickSealNode(cdp, sessionId, 1);
      await checkSelector(cdp, sessionId, ".seal-overlay", true, "wrong seal node fail-forwards instead of dead end");
      const done = await evaluate(cdp, sessionId, "document.querySelectorAll('.seal-node.done').length");
      if (done === 0) pass("wrong seal node resets visible progress");
      else fail("wrong seal node did not reset visible progress", { done });
    }
    for (const node of [2, 4, 1, 5, 3]) await mustClickSealNode(cdp, sessionId, node);
    await checkText(cdp, sessionId, "Чужая память", "Echo scene");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-04-echo`);

    await mustClickAction(cdp, sessionId, "hypothesis.seed");
    await mustClickAction(cdp, sessionId, "scene.meet_egor");
    await checkText(cdp, sessionId, "Незнакомец, который опоздал", "Egor encounter");
    for (const tone of ["direct", "sarcastic", "cold"]) {
      await checkAction(cdp, sessionId, `egor.${tone}`, true, `Egor choice ${tone}`);
    }
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-05-egor-before-choice`);
    await mustClickAction(cdp, sessionId, `egor.${config.egor}`);
    await checkSelector(cdp, sessionId, ".egor-response", true, `Egor response to ${config.egor}`);
    await checkAction(cdp, sessionId, "scene.go_home", true, "return home after Egor response");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-06-egor-response`);

    await mustClickAction(cdp, sessionId, "scene.go_home");
    await checkText(cdp, sessionId, "Первая версия правды", "board scene");
    await mustClickAction(cdp, sessionId, "board.open");
    await checkSelector(cdp, sessionId, ".board-overlay", true, "evidence board overlay");
    await checkAction(cdp, sessionId, "board.form_hypothesis", false, "hypothesis unavailable before links");

    if (config.testBoardClose) {
      await mustClickAction(cdp, sessionId, "board.close");
      await checkSelector(cdp, sessionId, ".board-overlay", false, "board closes from UI");
      await mustClickAction(cdp, sessionId, "board.open");
    }
    await mustClickAction(cdp, sessionId, "board.link.symbol_drag");
    await checkAction(cdp, sessionId, "board.form_hypothesis", false, "one evidence link is insufficient");
    await mustClickAction(cdp, sessionId, "board.link.echo_symbol");
    await checkAction(cdp, sessionId, "board.form_hypothesis", true, "two links + Echo enable hypothesis");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-07-board-ready`);
    await mustClickAction(cdp, sessionId, "board.form_hypothesis");
    await checkSelector(cdp, sessionId, ".board-overlay", false, "hypothesis closes board");
    await checkAction(cdp, sessionId, "scene.finish", true, "finish prologue after hypothesis");
    await mustClickAction(cdp, sessionId, "scene.finish");
    await checkText(cdp, sessionId, "След найден. Ответа нет.", "ending hook");
    await checkAction(cdp, sessionId, "game.restart", true, "restart from ending");
    if (config.capture) await screenshot(cdp, sessionId, `${config.name}-08-ending`);
  } catch (error) {
    if (error instanceof ScenarioAbort) fail(error.message);
    else {
      fail(`Unexpected scenario error: ${error.message}`);
      console.error(error.stack || error);
    }
  }
  report.scenarios.push({
    name: config.name,
    sofia: config.sofia,
    egor: config.egor,
    viewport: `${config.width}x${config.height}`,
    failures: report.failures.length - startFailures
  });
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const { server, port } = await staticServer();
  const url = `http://127.0.0.1:${port}/`;
  const userDataDir = join(tmpdir(), `novella-ui-playtest-${process.pid}-${Date.now()}`);
  await mkdir(userDataDir, { recursive: true });
  let chrome;
  let cdp;
  try {
    chrome = await launchChromium(userDataDir);
    cdp = new CDP(chrome.wsUrl);
    await cdp.ready();
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);

    await playScenario(cdp, sessionId, url, {
      name: "direct-soft-1920",
      sofia: "soft",
      egor: "direct",
      width: 1920,
      height: 1080,
      capture: true,
      testPhoneClose: true,
      testSealCancel: true,
      testWrongSeal: true,
      testBoardClose: true
    });
    await playScenario(cdp, sessionId, url, {
      name: "sarcastic-sarcastic-1920",
      sofia: "sarcastic",
      egor: "sarcastic",
      width: 1920,
      height: 1080,
      capture: false
    });
    await playScenario(cdp, sessionId, url, {
      name: "silent-cold-1366",
      sofia: "silent",
      egor: "cold",
      width: 1366,
      height: 768,
      capture: true
    });

    report.finished_at = new Date().toISOString();
    report.total_failures = report.failures.length;
    await writeFile(join(OUT, "report.json"), JSON.stringify(report, null, 2));
    console.log(`\nui-playtest: ${report.scenarios.length} scenarios, ${report.failures.length} failure(s)`);
    if (report.failures.length) process.exitCode = 1;
  } finally {
    try { if (cdp) await cdp.send("Browser.close"); } catch {}
    try { cdp?.close(); } catch {}
    if (chrome?.child?.pid && chrome.child.exitCode === null) {
      try {
        if (process.platform === "win32") chrome.child.kill("SIGKILL");
        else process.kill(-chrome.child.pid, "SIGTERM");
      } catch {}
      await sleep(800);
      if (chrome.child.exitCode === null) {
        try {
          if (process.platform === "win32") chrome.child.kill("SIGKILL");
          else process.kill(-chrome.child.pid, "SIGKILL");
        } catch {}
      }
    }
    await new Promise((resolve) => server.close(resolve));
    await rm(userDataDir, { recursive: true, force: true });
  }
}

let timeoutHandle;
const timeout = new Promise((_, reject) => {
  timeoutHandle = setTimeout(() => reject(new Error(`ui-playtest exceeded ${RUN_TIMEOUT_MS}ms hard timeout`)), RUN_TIMEOUT_MS);
});
try {
  await Promise.race([run(), timeout]);
} catch (error) {
  console.error(`ui-playtest failed: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutHandle);
}
