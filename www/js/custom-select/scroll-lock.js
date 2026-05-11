// Файл: www/js/custom-select/scroll-lock.js

import { getActiveSelects } from "./registry.js?v=VERSION";

const SCROLL_LOCK_CLASS_HTML = "cs-scroll-lock-html";
const SCROLL_LOCK_CLASS_BODY = "cs-scroll-lock-body";

let openCount = 0;
let blockerBound = false;

function isInsideOpenPanel(target) {
  if (!(target instanceof Node)) return false;

  for (const select of getActiveSelects()) {
    if (!select?.isOpen || !select?.optionsPanel) continue;
    if (select.optionsPanel.contains(target)) return true;
  }

  return false;
}

function preventScrollEvent(e) {
  if (isInsideOpenPanel(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
}

function preventScrollKeys(e) {
  const blocked = [
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
  ];

  if (!blocked.includes(e.key)) return;
  if (isInsideOpenPanel(e.target)) return;

  e.preventDefault();
  e.stopPropagation();
}

function bindBlockers() {
  if (blockerBound) return;
  blockerBound = true;

  document.addEventListener("wheel", preventScrollEvent, {
    passive: false,
    capture: true,
  });
  document.addEventListener("touchmove", preventScrollEvent, {
    passive: false,
    capture: true,
  });
  document.addEventListener("keydown", preventScrollKeys, { capture: true });
}

function unbindBlockers() {
  if (!blockerBound) return;
  blockerBound = false;

  document.removeEventListener("wheel", preventScrollEvent, true);
  document.removeEventListener("touchmove", preventScrollEvent, true);
  document.removeEventListener("keydown", preventScrollKeys, true);
}

function ensureLockStyles() {
  if (document.getElementById("__custom_select_scroll_lock_styles__")) return;

  const style = document.createElement("style");
  style.id = "__custom_select_scroll_lock_styles__";
  style.textContent = `
    html.${SCROLL_LOCK_CLASS_HTML},
    body.${SCROLL_LOCK_CLASS_BODY} {
      overscroll-behavior: none !important;
      touch-action: none !important;
    }

    body.${SCROLL_LOCK_CLASS_BODY} {
      overflow: hidden !important;
    }
  `;
  document.head.appendChild(style);
}

export function lockPageScroll() {
  ensureLockStyles();

  openCount += 1;
  if (openCount > 1) return;

  bindBlockers();
  document.documentElement.classList.add(SCROLL_LOCK_CLASS_HTML);
  document.body.classList.add(SCROLL_LOCK_CLASS_BODY);
}

export function unlockPageScroll() {
  if (openCount <= 0) {
    openCount = 0;
    return;
  }

  openCount -= 1;
  if (openCount > 0) return;

  unbindBlockers();
  document.documentElement.classList.remove(SCROLL_LOCK_CLASS_HTML);
  document.body.classList.remove(SCROLL_LOCK_CLASS_BODY);
}