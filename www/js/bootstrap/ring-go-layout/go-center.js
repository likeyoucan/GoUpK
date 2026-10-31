// Файл: www/js/bootstrap/ring-go-layout/go-center.js

import { clamp, snap2, getRingWrapForDisplay } from "./geometry.js?v=VERSION";

const displayState = new WeakMap();

function getOpticalTextShift(displayEl, text) {
  const style = getComputedStyle(displayEl);
  const fontStyle = style.fontStyle || "normal";
  const fontVariant = style.fontVariant || "normal";
  const fontWeight = style.fontWeight || "700";
  const fontSize = style.fontSize || "64px";
  const fontFamily = style.fontFamily || "system-ui";

  const canvas =
    getOpticalTextShift._canvas ||
    (getOpticalTextShift._canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { x: 0, y: 0 };

  ctx.font = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize} ${fontFamily}`;
  const m = ctx.measureText(text);

  const hasBox =
    Number.isFinite(m.actualBoundingBoxLeft) &&
    Number.isFinite(m.actualBoundingBoxRight) &&
    Number.isFinite(m.actualBoundingBoxAscent) &&
    Number.isFinite(m.actualBoundingBoxDescent);

  if (!hasBox || !m.width) return { x: 0, y: 0 };

  // Horizontal optical center relative to advance width center.
  const inkCenterFromStartX =
    (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  const advanceCenterFromStartX = m.width / 2;
  const shiftX = inkCenterFromStartX - advanceCenterFromStartX;

  // Vertical optical center relative to baseline.
  const inkCenterYFromBaseline =
    (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;

  // Mild correction to keep GO visually centered across devices.
  const shiftY = inkCenterYFromBaseline * 0.08;

  return { x: shiftX, y: shiftY };
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

  // Always center against ring geometry.
  const targetCx = wrapRect.left + wrapRect.width / 2;
  const targetCy = wrapRect.top + wrapRect.height / 2;

  const prevX = displayEl.style.getPropertyValue("--go-nudge-x");
  const prevY = displayEl.style.getPropertyValue("--go-nudge-y");

  // Measure in neutral position to avoid drift accumulation.
  displayEl.style.setProperty("--go-nudge-x", "0px");
  displayEl.style.setProperty("--go-nudge-y", "0px");
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
    displayEl.style.setProperty("--go-nudge-x", prevX || "0px");
    displayEl.style.setProperty("--go-nudge-y", prevY || "0px");
    return;
  }

  let dx = targetCx - (txtRect.left + txtRect.width / 2);
  let dy = targetCy - (txtRect.top + txtRect.height / 2);

  // Font-aware optical correction.
  const optical = getOpticalTextShift(displayEl, "GO");
  dx -= optical.x;
  dy -= optical.y;

  // Extra baseline compensation: uppercase text often looks lower in line box.
  const style = getComputedStyle(displayEl);
  const fontPx = parseFloat(style.fontSize) || 0;

  // Adaptive upward shift by font size (safe range).
  const baselineLift = clamp(fontPx * 0.045, 1, 6);
  dy -= baselineLift;

  // Tiny perceptual compensation when GO is skewed.
  const skewRaw = style.getPropertyValue("--go-skew-deg") || "0";
  const skewDeg = Number.parseFloat(skewRaw) || 0;
  const skewLift = clamp(Math.abs(skewDeg) * 0.06, 0, 1.4);
  dy -= skewLift;

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
