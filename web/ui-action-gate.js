const root = document.querySelector("#app");

function allowedActionIds() {
  if (!window.__NOVELLA__?.actions) return null;
  return new Set(window.__NOVELLA__.actions().map((action) => action.id));
}

function reconcile() {
  const allowed = allowedActionIds();
  if (!allowed || !root) return;

  for (const element of root.querySelectorAll("[data-action]")) {
    const id = element.dataset.action;
    const isAllowed = allowed.has(id);
    if (element.hidden === !isAllowed) continue;
    element.hidden = !isAllowed;
    element.setAttribute("aria-hidden", isAllowed ? "false" : "true");
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
