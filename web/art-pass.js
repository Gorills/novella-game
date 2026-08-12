const PACKED = {
  apartment: ["./assets/packed/apartment/00.b64"],
  crime: ["./assets/packed/crime/00.b64"],
  echo: ["./assets/packed/echo/00.b64"],
  katerina: Array.from({ length: 5 }, (_, i) => `./assets/packed/katerina/${String(i).padStart(2, "0")}.b64`)
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
  try { await image.decode(); } catch {
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
    });
  }
}

function applySceneArt() {
  const app = document.querySelector("#app");
  if (!app) return;

  const apartment = app.querySelector(".scene-apartment .apartment-environment, .scene-board .apartment-environment");
  if (apartment && ART.apartment) {
    apartment.classList.add("production-art", "production-apartment");
    apartment.style.setProperty("--production-art", `url("${ART.apartment}")`);
  }

  const crime = app.querySelector(".scene-crime .crime-environment, .scene-egor .crime-environment");
  if (crime && ART.crime) {
    crime.classList.add("production-art", "production-crime");
    crime.style.setProperty("--production-art", `url("${ART.crime}")`);
  }

  const echo = app.querySelector(".scene-echo .echo-environment");
  if (echo && ART.echo) {
    echo.classList.add("production-art", "production-echo");
    echo.style.setProperty("--production-art", `url("${ART.echo}")`);
  }

  if (ART.katerina) {
    app.querySelectorAll("img.katya, img.menu-katya").forEach((image) => {
      if (image.src !== ART.katerina) image.src = ART.katerina;
    });
  }
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
