const PACKED = {
  interior: [
    "./assets/packed/apartment/00.b64",
    "./assets/packed/apartment/01.b64"
  ],
  street: [
    "./assets/packed/crime/00.b64",
    "./assets/packed/crime/01.b64",
    "./assets/packed/crime/02.b64",
    "./assets/packed/crime/03.b64"
  ],
  echo: [
    "./assets/packed/echo/00.b64",
    "./assets/packed/echo/01.b64",
    "./assets/packed/echo/02.b64"
  ]
};

const ART = {};

async function packedDataUrl(parts) {
  const chunks = await Promise.all(parts.map(async (url) => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Missing art chunk: ${url}`);
    return (await response.text()).replace(/\s+/g, "");
  }));
  return `data:image/webp;base64,${chunks.join("")}`;
}

async function preload(url) {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
    });
  }
}

function apply(element, art, className) {
  if (!element || !art) return;
  element.classList.add("production-art", className);
  element.style.setProperty("--production-art", `url("${art}")`);
}

function applySceneArt() {
  const app = document.querySelector("#app");
  if (!app) return;

  apply(app.querySelector(".scene-menu .environment"), ART.interior, "production-keyart");
  apply(app.querySelector(".scene-studio .environment"), ART.interior, "production-studio");
  apply(app.querySelector(".scene-home .environment"), ART.interior, "production-home");
  apply(app.querySelector(".scene-ending .environment"), ART.interior, "production-ending");

  for (const id of ["walk", "cordon", "egor"]) {
    apply(app.querySelector(`.scene-${id} .environment`), ART.street, `production-${id}`);
  }

  apply(app.querySelector(".scene-echo .environment"), ART.echo, "production-echo");
}

async function boot() {
  const entries = await Promise.all(Object.entries(PACKED).map(async ([name, parts]) => {
    const url = await packedDataUrl(parts);
    await preload(url);
    return [name, url];
  }));

  Object.assign(ART, Object.fromEntries(entries));
  document.documentElement.dataset.productionArtReady = "true";
  applySceneArt();
  new MutationObserver(applySceneArt).observe(document.querySelector("#app"), { childList: true, subtree: true });
}

boot().catch((error) => {
  console.error("production art pass failed", error);
  document.documentElement.dataset.productionArtReady = "failed";
});
