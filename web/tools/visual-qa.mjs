import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const WEB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(WEB_ROOT, ".qa", "screenshots");
const RUN_TIMEOUT_MS = Number(process.env.VISUAL_QA_TIMEOUT_MS || 90000);
const STEP_TIMEOUT_MS = 15000;
const CANDIDATES = [process.env.CHROMIUM_PATH, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].filter(Boolean);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".webp":"image/webp", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml" };

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
      res.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function launchChromium(url, userDataDir) {
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
        resolve({ child, wsUrl: match[1], url });
      }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => {
      if (!stderr.includes("DevTools listening")) {
        clearTimeout(timer);
        reject(new Error(`Chromium exited before QA started (${code}). ${stderr.slice(-800)}`));
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
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    });
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), STEP_TIMEOUT_MS);
      this.ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener("error", (e) => { clearTimeout(timer); reject(e); }, { once: true });
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, STEP_TIMEOUT_MS);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

async function waitForReady(cdp, sessionId) {
  const started = Date.now();
  while (Date.now() - started < STEP_TIMEOUT_MS) {
    const result = await cdp.send("Runtime.evaluate", { expression: "Boolean(window.__NOVELLA__) && document.readyState !== 'loading' && document.documentElement.dataset.productionArtReady === 'true'", returnByValue: true }, sessionId);
    if (result.result.value) return;
    await sleep(120);
  }
  throw new Error("Game did not become ready");
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result.value;
}

async function setViewport(cdp, sessionId, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
}

async function waitForImages(cdp, sessionId) {
  const started = Date.now();
  while (Date.now() - started < STEP_TIMEOUT_MS) {
    const ready = await evaluate(cdp, sessionId, "Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)");
    if (ready) return;
    await sleep(80);
  }
  throw new Error("Scene images did not finish loading");
}

async function shot(cdp, sessionId, name, width, height) {
  await setViewport(cdp, sessionId, width, height);
  await waitForImages(cdp, sessionId);
  await sleep(120);
  const data = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }, sessionId);
  const path = join(OUT, `${name}-${width}x${height}.png`);
  await writeFile(path, Buffer.from(data.data, "base64"));
  console.log(`screenshot: ${path}`);
}

async function act(cdp, sessionId, id, payload = {}) {
  const expr = `window.__NOVELLA__.act(${JSON.stringify(id)}, ${JSON.stringify(payload)})`;
  return evaluate(cdp, sessionId, expr);
}

async function reset(cdp, sessionId) { return evaluate(cdp, sessionId, "window.__NOVELLA__.reset()"); }

async function completeApartment(cdp, sessionId, reply = "sarcastic") {
  await act(cdp, sessionId, "phone.open");
  await act(cdp, sessionId, `phone.reply.${reply}`);
  await act(cdp, sessionId, "apartment.inspect_sketch");
}

async function collectCrimeClues(cdp, sessionId) {
  for (const clue of ["symbol_ground", "pendant", "drag_marks"]) await act(cdp, sessionId, `inspect.${clue}`);
}

async function runQa() {
  await mkdir(OUT, { recursive: true });
  const { server, port } = await staticServer();
  const url = `http://127.0.0.1:${port}/`;
  const userDataDir = join(tmpdir(), `novella-visual-qa-${process.pid}-${Date.now()}`);
  await mkdir(userDataDir, { recursive: true });
  let chrome;
  let cdp;
  try {
    chrome = await launchChromium(url, userDataDir);
    cdp = new CDP(chrome.wsUrl);
    await cdp.ready();
    const { targetId } = await cdp.send("Target.createTarget", { url });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await setViewport(cdp, sessionId, 1920, 1080);
    await waitForReady(cdp, sessionId);

    await shot(cdp, sessionId, "01-menu", 1920, 1080);
    await act(cdp, sessionId, "game.start");
    await shot(cdp, sessionId, "02-apartment", 1920, 1080);
    await act(cdp, sessionId, "phone.open");
    await shot(cdp, sessionId, "02b-phone", 1920, 1080);
    await act(cdp, sessionId, "phone.reply.sarcastic");
    await act(cdp, sessionId, "apartment.inspect_sketch");
    await act(cdp, sessionId, "scene.go_street");
    await act(cdp, sessionId, "street.touch_seal");
    await act(cdp, sessionId, "scene.go_crime");
    await shot(cdp, sessionId, "03-investigation", 1920, 1080);
    await collectCrimeClues(cdp, sessionId);
    await act(cdp, sessionId, "seal.begin");
    for (const node of [2,4,1,5,3]) await act(cdp, sessionId, "seal.node", { node });
    await shot(cdp, sessionId, "04-echo", 1920, 1080);
    await act(cdp, sessionId, "hypothesis.seed");
    await act(cdp, sessionId, "scene.meet_egor");
    await shot(cdp, sessionId, "05-egor", 1920, 1080);
    await act(cdp, sessionId, "egor.direct");
    await shot(cdp, sessionId, "05b-egor-direct-response", 1920, 1080);
    await act(cdp, sessionId, "scene.go_home");
    await act(cdp, sessionId, "board.open");
    await act(cdp, sessionId, "board.link.symbol_drag");
    await act(cdp, sessionId, "board.link.echo_symbol");
    await shot(cdp, sessionId, "06-evidence-board", 1920, 1080);

    await reset(cdp, sessionId);
    await shot(cdp, sessionId, "07-menu-small", 1366, 768);
    await act(cdp, sessionId, "game.start");
    await completeApartment(cdp, sessionId, "silent");
    await act(cdp, sessionId, "scene.go_street");
    await act(cdp, sessionId, "scene.go_crime");
    await collectCrimeClues(cdp, sessionId);
    await act(cdp, sessionId, "seal.begin");
    for (const node of [2,4,1,5,3]) await act(cdp, sessionId, "seal.node", { node });
    await act(cdp, sessionId, "scene.meet_egor");
    await shot(cdp, sessionId, "08-egor-small", 1366, 768);

    console.log("visual-qa: completed 9 acceptance screenshots using one Chromium process");
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
        try { process.platform === "win32" ? chrome.child.kill("SIGKILL") : process.kill(-chrome.child.pid, "SIGKILL"); } catch {}
      }
    }
    await new Promise((resolve) => server.close(resolve));
    await rm(userDataDir, { recursive: true, force: true });
  }
}

let timeoutHandle;
const timeout = new Promise((_, reject) => {
  timeoutHandle = setTimeout(() => reject(new Error(`visual-qa exceeded ${RUN_TIMEOUT_MS}ms hard timeout`)), RUN_TIMEOUT_MS);
});
try {
  await Promise.race([runQa(), timeout]);
} catch (error) {
  console.error(`visual-qa failed: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutHandle);
}
