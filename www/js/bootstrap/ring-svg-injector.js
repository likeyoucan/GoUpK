// Файл: www/js/bootstrap/ring-svg-injector.js

function svgEl(tag, attrs = {}, classList = []) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);

  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, String(value));
  });

  if (classList.length) {
    el.classList.add(...classList);
  }

  return el;
}

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

    const svg = svgEl(
      "svg",
      {
        focusable: "false",
        viewBox: "0 0 100 100",
        "aria-hidden": "true",
      },
      ["w-full", "h-full", "transform"],
    );

    if (type === "tm") {
      svg.classList.add("pointer-events-none");
    }

    const baseCircle = svgEl(
      "circle",
      {
        "stroke-width": "var(--ring-stroke-width, 4)",
        stroke: "currentColor",
        fill: "transparent",
        r: "45",
        cx: "50",
        cy: "50",
      },
      [
        "app-text",
        "opacity-10",
        "transition-all",
        "duration-300",
        "group-focus-visible:primary-text",
        "group-focus-visible:opacity-30",
      ],
    );

    const progressCircle = svgEl(
      "circle",
      {
        id: ringId,
        "stroke-width": "var(--ring-stroke-width, 4)",
        "stroke-linecap": "round",
        fill: "transparent",
        r: "45",
        cx: "50",
        cy: "50",
      },
      ["progress-ring__circle", "primary-stroke"],
    );

    svg.append(baseCircle, progressCircle);
    container.insertBefore(svg, container.firstChild);
  });
}