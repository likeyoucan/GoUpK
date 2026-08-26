// Файл: www/js/bootstrap/ring-go-layout/go-center.js

import {
  clamp,
  snap2,
  getTopHalfEl,
  getRingWrapForDisplay,
} from "./geometry.js?v=VERSION";

const displayState = new WeakMap();

function setVarIfChanged(el, name, value) {
  if (!el) return;
  const prev = el.style.getPropertyValue(name);
  if (prev !== value) {
    el.style.setProperty(name, value);
  }
}

function setDataIfChanged(el, key, value) {
  if (!el) return;
  if (el.dataset[key] !== value) {
    el.dataset[key] = value;
  }
}

export function isGoDisplay(displayEl) {
  if (!displayEl) return false;
  const text = String(displayEl.textContent || "")
    .trim()
    .toUpperCase();
  return displayEl.classList.contains("is-go") && text === "GO";
}

export function getDisplayState(displayEl) {
  if (!displayEl) return { wasGo: false, text: "" };
  return displayState.get(displayEl) || { wasGo: false, text: "" };
}

export function setDisplayState(displayEl, state) {
  if (!displayEl) return;
  displayState.set(displayEl, state);
}

export function triggerGoEnter(displayEl) {
  if (!isGoDisplay(displayEl)) return;
  if (displayEl.classList.contains("go-enter")) return;

  displayEl.classList.remove("go-enter");
  // Controlled reflow only on real state transition
  void displayEl.offsetWidth;
  displayEl.classList.add("go-enter");
}

export function triggerTimeEnter(displayEl) {
  if (!displayEl) return;

  const text = String(displayEl.textContent || "")
    .trim()
    .toUpperCase();
  const isTimeLike = text !== "GO" && /[:\d]/.test(text);
  if (!isTimeLike) return;
  if (displayEl.classList.contains("time-enter")) return;

  displayEl.classList.remove("time-enter");
  // Controlled reflow only on real state transition
  void displayEl.offsetWidth;
  displayEl.classList.add("time-enter");
}

export function centerGoDisplay(displayEl) {
  if (!displayEl) return;

  const text = String(displayEl.textContent || "")
    .trim()
    .toUpperCase();
  const isGo = displayEl.classList.contains("is-go") && text === "GO";

  if (!isGo) {
    setVarIfChanged(displayEl, "--go-nudge-x", "0px");
    setVarIfChanged(displayEl, "--go-nudge-y", "0px");
    setDataIfChanged(displayEl, "goNudgeX", "0");
    setDataIfChanged(displayEl, "goNudgeY", "0");
    return;
  }

  const wrap = getRingWrapForDisplay(displayEl);
  if (!wrap) return;

  const wrapRect = wrap.getBoundingClientRect();
  if (!wrapRect || !wrapRect.width || !wrapRect.height) return;

  const topHalf = getTopHalfEl(wrap);
  const topRect = topHalf?.getBoundingClientRect?.();

  const targetCx = wrapRect.left + wrapRect.width / 2;
  const fallbackCy = wrapRect.top + wrapRect.height / 2;

  // ВАЖНО: центр берем от top-half (как в старом рабочем коде),
  // а затем ограничиваем в пределах кольца.
  const targetCyRaw =
    topRect && topRect.height > 0
      ? topRect.top + topRect.height / 2
      : fallbackCy;

  const targetCy = clamp(targetCyRaw, wrapRect.top + 4, wrapRect.bottom - 4);

  const prevX = displayEl.style.getPropertyValue("--go-nudge-x");
  const prevY = displayEl.style.getPropertyValue("--go-nudge-y");

  // Меряем текст в нейтральной позиции, чтобы не накапливать дрейф.
  setVarIfChanged(displayEl, "--go-nudge-x", "0px");
  setVarIfChanged(displayEl, "--go-nudge-y", "0px");
  void displayEl.offsetWidth;

  let inkRect = null;
  const textNode = displayEl.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.selectNodeContents(displayEl);
    const r = range.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) {
      inkRect = r;
    }
    range.detach?.();
  }

  const txtRect = inkRect || displayEl.getBoundingClientRect();
  if (!txtRect || !txtRect.width || !txtRect.height) {
    setVarIfChanged(displayEl, "--go-nudge-x", prevX || "0px");
    setVarIfChanged(displayEl, "--go-nudge-y", prevY || "0px");
    return;
  }

  let dx = targetCx - (txtRect.left + txtRect.width / 2);
  let dy = targetCy - (txtRect.top + txtRect.height / 2);

  const opticalUp = Math.max(1.5, txtRect.height * 0.06);
  dy -= opticalUp;

  const nextX = snap2(clamp(dx, -36, 36));
  const nextY = snap2(clamp(dy, -36, 36));

  setVarIfChanged(displayEl, "--go-nudge-x", `${nextX}px`);
  setVarIfChanged(displayEl, "--go-nudge-y", `${nextY}px`);
  setDataIfChanged(displayEl, "goNudgeX", String(nextX));
  setDataIfChanged(displayEl, "goNudgeY", String(nextY));
}

export function resetGoNudges(displays) {
  displays.forEach((displayEl) => {
    if (!displayEl) return;
    setVarIfChanged(displayEl, "--go-nudge-x", "0px");
    setVarIfChanged(displayEl, "--go-nudge-y", "0px");
    setDataIfChanged(displayEl, "goNudgeX", "0");
    setDataIfChanged(displayEl, "goNudgeY", "0");
  });
}
