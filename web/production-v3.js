const LINK_NODES = {
  sketch_symbol: [".card-sketch", ".card-symbol"],
  symbol_tattoo: [".card-symbol", ".card-tattoo"],
  photo_sketch: [".card-photo", ".card-sketch"]
};

function centerInCanvas(element, canvasRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - canvasRect.left + rect.width / 2,
    y: rect.top - canvasRect.top + rect.height / 2,
    width: rect.width,
    height: rect.height
  };
}

function edgePoint(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX >= absY) {
    return { x: from.x + Math.sign(dx || 1) * from.width / 2, y: from.y };
  }
  return { x: from.x, y: from.y + Math.sign(dy || 1) * from.height / 2 };
}

function svgElement(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}

function drawReasoningLinks() {
  const canvas = document.querySelector(".desk-canvas");
  if (!canvas || !window.__NOVELLA__) return;

  canvas.querySelectorAll(".connection-line,.desk-link-layer").forEach((node) => node.remove());
  const links = window.__NOVELLA__.observe().evidence_links || [];
  if (!links.length) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const svg = svgElement("svg", {
    class: "desk-link-layer",
    viewBox: `0 0 ${rect.width} ${rect.height}`,
    preserveAspectRatio: "none",
    "aria-hidden": "true"
  });

  for (const id of links) {
    const selectors = LINK_NODES[id];
    if (!selectors) continue;
    const aEl = canvas.querySelector(selectors[0]);
    const bEl = canvas.querySelector(selectors[1]);
    if (!aEl || !bEl) continue;

    const a = centerInCanvas(aEl, rect);
    const b = centerInCanvas(bEl, rect);
    const start = edgePoint(a, b);
    const end = edgePoint(b, a);
    const dx = end.x - start.x;
    const control = Math.max(42, Math.min(130, Math.abs(dx) * .28));
    const c1x = start.x + Math.sign(dx || 1) * control;
    const c2x = end.x - Math.sign(dx || 1) * control;

    const path = svgElement("path", {
      d: `M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`,
      class: `desk-link-path link-${id}`
    });
    const startDot = svgElement("circle", { cx: start.x, cy: start.y, r: 5, class: "desk-link-anchor" });
    const endDot = svgElement("circle", { cx: end.x, cy: end.y, r: 5, class: "desk-link-anchor" });
    svg.append(path, startDot, endDot);
  }

  canvas.prepend(svg);
}

let scheduled = false;
function scheduleDraw() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    drawReasoningLinks();
  });
}

new MutationObserver(scheduleDraw).observe(document.querySelector("#app"), { childList: true, subtree: true });
window.addEventListener("resize", scheduleDraw);
scheduleDraw();
