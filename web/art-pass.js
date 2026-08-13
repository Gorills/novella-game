const ART = {
  menu: "./assets/scenes/menu-night.svg",
  studio: "./assets/scenes/studio-night.svg",
  street: "./assets/scenes/street-rain.svg",
  echo: "./assets/scenes/echo-fracture.svg",
  home: "./assets/scenes/apartment-night.svg"
};

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

  apply(app.querySelector(".scene-menu .environment"), ART.menu, "production-keyart");
  apply(app.querySelector(".scene-studio .environment"), ART.studio, "production-studio");
  apply(app.querySelector(".scene-home .environment"), ART.home, "production-home");
  apply(app.querySelector(".scene-ending .environment"), ART.home, "production-ending");

  for (const id of ["walk", "cordon", "egor"]) {
    apply(app.querySelector(`.scene-${id} .environment`), ART.street, `production-${id}`);
  }

  apply(app.querySelector(".scene-echo .environment"), ART.echo, "production-echo");
}

async function boot() {
  await Promise.all(Object.values(ART).map(preload));
  document.documentElement.dataset.productionArtReady = "true";
  applySceneArt();
  new MutationObserver(applySceneArt).observe(document.querySelector("#app"), { childList: true, subtree: true });
}

boot().catch((error) => {
  console.error("production art pass failed", error);
  document.documentElement.dataset.productionArtReady = "failed";
});
