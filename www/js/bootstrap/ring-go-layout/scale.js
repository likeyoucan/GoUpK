// Файл: www/js/bootstrap/ring-go-layout/scale.js

import {
  clamp,
  snap2,
  isCompactRing,
  isRowLayout,
  getTopHalfEl,
} from "./geometry.js?v=VERSION";

function setGoFontStable(displayEl, nextPx) {
  const prev = Number(displayEl.dataset.goFontPx || "0");

  if (prev > 0 && Math.abs(nextPx - prev) < 0.8) return;

  displayEl.style.setProperty("--go-font-dynamic", `${nextPx}px`);
  displayEl.dataset.goFontPx = String(nextPx);
}

function isBottomCollapsedInRow(displayEl) {
  const viewEl = displayEl?.closest(
    "#view-stopwatch, #view-timer, #view-tabata",
  );
  if (!viewEl) return false;

  // split-bottom-hidden is final state, data-split-target="bottom" is transitional/live state
  return (
    viewEl.classList.contains("split-bottom-hidden") ||
    viewEl.dataset.splitTarget === "bottom"
  );
}

export function applyMetaTextScale(wrap, ringPx) {
  if (!wrap || !ringPx) return;

  const rowLayout = isRowLayout(getTopHalfEl(wrap));
  const compact = isCompactRing(ringPx);

  const metaFontPx = snap2(
    clamp(
      ringPx *
        (compact ? (rowLayout ? 0.044 : 0.046) : rowLayout ? 0.054 : 0.05),
      compact ? 8 : 10,
      compact ? 12 : rowLayout ? 17 : 20,
    ),
  );

  const statusOffsetPx = snap2(
    clamp(
      ringPx * (compact ? 0.22 : rowLayout ? 0.26 : 0.28),
      compact ? 20 : 48,
      compact ? 56 : rowLayout ? 112 : 140,
    ),
  );

  const extendedOffsetPx = snap2(
    clamp(
      ringPx * (compact ? 0.22 : rowLayout ? 0.26 : 0.28),
      compact ? 20 : 48,
      compact ? 56 : rowLayout ? 112 : 140,
    ),
  );

  const statusNudgePx = rowLayout ? 4 : 2;
  const extendedNudgePx = rowLayout ? 1 : 0;

  wrap.style.setProperty("--ring-meta-font-px", `${metaFontPx}px`);
  wrap.style.setProperty("--ring-status-offset-px", `${statusOffsetPx}px`);
  wrap.style.setProperty("--ring-extended-offset-px", `${extendedOffsetPx}px`);
  wrap.style.setProperty("--ring-status-nudge-y", `${statusNudgePx}px`);
  wrap.style.setProperty("--ring-extended-nudge-y", `${extendedNudgePx}px`);
}

export function applyDisplayScale(displayEl, ringPx, renderedRingPx) {
  if (!displayEl || !ringPx) return;

  const rowLayout = isRowLayout(
    getTopHalfEl(displayEl.closest(".timer-circle-wrap")),
  );
  const text = String(displayEl.textContent || "").trim();
  const isGo =
    displayEl.classList.contains("is-go") && text.toUpperCase() === "GO";

  if (isGo) {
    const ringForGo = renderedRingPx || ringPx;
    const compact = isCompactRing(ringForGo);

    const minGo = compact ? 28 : rowLayout ? 44 : 48;
    const maxGo = compact ? 76 : rowLayout ? 132 : 168;

    let goPx = ringForGo * 0.258;
    goPx = clamp(goPx, minGo, maxGo);

    displayEl.style.setProperty("--go-skew-deg", "-11deg");

    const renderedWordW = displayEl.getBoundingClientRect().width || 0;
    if (renderedWordW > 0) {
      const targetWordW = ringForGo * (compact ? 0.42 : 0.355);
      const k = clamp(targetWordW / renderedWordW, 0.88, 1.14);
      goPx = clamp(goPx * k, minGo, maxGo);
    }

    goPx = snap2(goPx);
    setGoFontStable(displayEl, goPx);
    return;
  }

  const compact = isCompactRing(ringPx);
  const hasMs = text.includes(".");

  // Special case: in 2-column layout when bottom panel is collapsed to 100% top,
  // ring grows a lot, so reduce numeric time scale.
  const rowBottomCollapsed = rowLayout && isBottomCollapsedInRow(displayEl);

  const base = compact
    ? hasMs
      ? 0.155
      : 0.175
    : rowLayout
      ? hasMs
        ? 0.132
        : 0.152
      : hasMs
        ? 0.128
        : 0.148;

  let rawTimer = ringPx * base;

  if (rowBottomCollapsed) {
    rawTimer *= 0.84;
  }

  const minPx = compact ? 10 : rowLayout ? 12 : 14;

  const hardMaxPx = rowBottomCollapsed
    ? hasMs
      ? 52
      : 56
    : compact
      ? 36
      : rowLayout
        ? 64
        : 84;

  const ratioMaxPx = rowBottomCollapsed
    ? ringPx * (hasMs ? 0.2 : 0.22)
    : ringPx * (hasMs ? 0.24 : 0.27);

  const timerPx = snap2(
    clamp(rawTimer, minPx, Math.min(hardMaxPx, ratioMaxPx)),
  );

  displayEl.style.setProperty("--timer-font-dynamic", `${timerPx}px`);
}
