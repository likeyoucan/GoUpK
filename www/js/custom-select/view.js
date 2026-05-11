// Файл: www/js/custom-select/view.js

export function createTrigger() {
  const trigger = document.createElement("div");
  trigger.className =
    "custom-select-trigger app-surface rounded-lg border app-border shadow-sm flex items-center justify-between w-full py-1.5 pl-3 pr-2 cursor-pointer transition-colors";
  trigger.setAttribute("role", "button");
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const selectedValueEl = document.createElement("span");
  selectedValueEl.className =
    "custom-select-value text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap";

  const arrowSvg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  arrowSvg.setAttribute("focusable", "false");
  arrowSvg.setAttribute("aria-hidden", "true");
  arrowSvg.setAttribute("viewBox", "0 0 24 24");
  arrowSvg.classList.add(
    "w-4",
    "h-4",
    "app-text-sec",
    "transition-transform",
    "duration-300",
  );

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("d", "M19 9l-7 7-7-7");
  arrowSvg.appendChild(path);

  trigger.append(selectedValueEl, arrowSvg);

  return { trigger, selectedValueEl, arrow: arrowSvg };
}

export function createPanel() {
  const panel = document.createElement("div");
  panel.className = "custom-select-options hidden";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("tabindex", "-1");
  return panel;
}

export function createOptionIcon(option) {
  if (!option?.iconPaths || !Array.isArray(option.iconPaths)) return null;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("w-4", "h-4", "shrink-0");

  option.iconPaths.forEach((d) => {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  });

  return svg;
}

export function appendOptionContent(container, option, iconBuilder) {
  container.replaceChildren();

  const icon = iconBuilder(option);
  const text = document.createElement("span");
  text.className = "whitespace-nowrap";
  text.textContent = option.text;

  if (container.classList.contains("custom-select-value")) {
    container.classList.add("inline-flex", "items-center", "gap-2");
    if (icon) container.appendChild(icon);
    container.appendChild(text);
    return;
  }

  const row = document.createElement("div");
  row.className = "flex items-center gap-2 w-full";
  if (icon) row.appendChild(icon);
  row.appendChild(text);
  container.appendChild(row);
}
