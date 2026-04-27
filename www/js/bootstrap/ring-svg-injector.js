// Файл: www/js/bootstrap/ring-svg-injector.js

export function initRingSvg() {
  const svgs = {
    sw: "sw-progressRing",
    tm: "tm-progressRing",
    tb: "tb-progressRing",
  };

  document.querySelectorAll("[data-ring]").forEach((container) => {
    const type = container.getAttribute("data-ring");
    const ringId = svgs[type];
    if (!ringId || container.querySelector("svg")) return;

    const pointerEventsClass = type === "tm" ? "pointer-events-none" : "";
    const svgHTML = `
      <svg focusable="false" class="w-full h-full transform ${pointerEventsClass}" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="app-text opacity-10 transition-all duration-300 group-focus-visible:primary-text group-focus-visible:opacity-30" stroke-width="var(--ring-stroke-width, 4)" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
        <circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="var(--ring-stroke-width, 4)" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" />
      </svg>`;
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}