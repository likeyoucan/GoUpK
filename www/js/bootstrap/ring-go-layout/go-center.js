// Файл: www/js/bootstrap/ring-go-layout/go-center.js

import {
  clamp,
  snap2,
  getTopHalfEl,
  getRingWrapForDisplay,
} from "./geometry.js?v=VERSION";

const displayState = new WeakMap();

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
    displayEl.style.setProperty("--go-nudge-x", "0px");
    displayEl.style.setProperty("--go-nudge-y", "0px");
    displayEl.dataset.goNudgeX = "0";
    displayEl.dataset.goNudgeY = "0";
    return;
  }

  const wrap = getRingWrapForDisplay(displayEl);
  if (!wrap) return;

  const wrapRect = wrap.getBoundingClientRect();
  if (!wrapRect || !wrapRect.width || !wrapRect.height) return;

  const topHalf = getTopHalfEl(wrap);
  const topRect = topHalf?.getBoundingClientRect?.();

  const targetCx = wrapRect.left + wrapRect.width / 2;

  // ВАЖНО: центр считаем по top-half (его видимой части в пределах wrap),
  // а не по экрану/viewport.
  let targetCy = wrapRect.top + wrapRect.height / 2;
  if (topRect && topRect.height > 0) {
    const visibleTop = Math.max(wrapRect.top, topRect.top);
    const visibleBottom = Math.min(wrapRect.bottom, topRect.bottom);

    if (visibleBottom > visibleTop) {
      targetCy = visibleTop + (visibleBottom - visibleTop) / 2;
    }
  }

  const prevX = displayEl.style.getPropertyValue("--go-nudge-x");
  const prevY = displayEl.style.getPropertyValue("--go-nudge-y");

  displayEl.style.setProperty("--go-nudge-x", "0px");
  displayEl.style.setProperty("--go-nudge-y", "0px");
  void displayEl.offsetWidth;

  // Более стабильное измерение для трансформируемого текста
  const txtRect = displayEl.getBoundingClientRect();
  if (!txtRect || !txtRect.width || !txtRect.height) {
    displayEl.style.setProperty("--go-nudge-x", prevX || "0px");
    displayEl.style.setProperty("--go-nudge-y", prevY || "0px");
    return;
  }

  let dx = targetCx - (txtRect.left + txtRect.width / 2);
  let dy = targetCy - (txtRect.top + txtRect.height / 2);

  // Оптическая компенсация (чуть вверх для визуального центра)
  const opticalUp = Math.max(2, txtRect.height * 0.09);
  dy -= opticalUp;

  const nextX = snap2(clamp(dx, -36, 36));
  const nextY = snap2(clamp(dy, -36, 36));

  displayEl.style.setProperty("--go-nudge-x", `${nextX}px`);
  displayEl.style.setProperty("--go-nudge-y", `${nextY}px`);
  displayEl.dataset.goNudgeX = String(nextX);
  displayEl.dataset.goNudgeY = String(nextY);
}

export function resetGoNudges(displays) {
  displays.forEach((displayEl) => {
    if (!displayEl) return;
    displayEl.style.setProperty("--go-nudge-x", "0px");
    displayEl.style.setProperty("--go-nudge-y", "0px");
    displayEl.dataset.goNudgeX = "0";
    displayEl.dataset.goNudgeY = "0";
  });
}
