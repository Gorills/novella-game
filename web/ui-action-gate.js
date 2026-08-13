const root = document.querySelector("#app");

function allowedActionIds() {
  if (!window.__NOVELLA__?.actions) return null;
  return new Set(window.__NOVELLA__.actions().map((action) => action.id));
}

function hideByCore(element) {
  if (element.dataset.coreGateHidden === "1") return;
  element.dataset.coreGateHidden = "1";
  element.hidden = true;
  element.setAttribute("aria-hidden", "true");
  element.style.setProperty("display", "none", "important");
}

function showByCore(element) {
  if (element.dataset.coreGateHidden !== "1") return;
  delete element.dataset.coreGateHidden;
  element.hidden = false;
  element.removeAttribute("aria-hidden");
  element.style.removeProperty("display");
}

function reconcile() {
  const allowed = allowedActionIds();
  if (!allowed || !root) return;

  for (const element of root.querySelectorAll("[data-action]")) {
    const isAllowed = allowed.has(element.dataset.action);
    if (isAllowed) showByCore(element);
    else hideByCore(element);
  }
}

function start() {
  if (!window.__NOVELLA__?.actions) {
    requestAnimationFrame(start);
    return;
  }
  reconcile();
  const observer = new MutationObserver(() => queueMicrotask(reconcile));
  observer.observe(root, { childList: true, subtree: true });
}

start();
