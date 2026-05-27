// Файл: www/js/bootstrap/ring-go-layout.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getTopHalfEl(wrap) {
  return wrap.closest(".view-top-half");
}

function isRowLayout(topHalfEl) {
  if (!topHalfEl) return false;
  const parentView = topHalfEl.closest(
    "#view-stopwatch, #view-timer, #view-tabata",
  );
  if (!parentView) return false;
  return getComputedStyle(parentView).flexDirection.startsWith("row");
}

function calcDynamicRingSizePx(wrap) {
  const topHalfEl = getTopHalfEl(wrap);
  const rect = topHalfEl?.getBoundingClientRect?.();
  if (!rect) {
    const fallback = Math.min(wrap.clientWidth || 0, wrap.clientHeight || 0);
    return Math.round(clamp(fallback * 0.68, 170, 420));
  }

  const limitingSide = Math.min(rect.width, rect.height);
  const row = isRowLayout(topHalfEl);

  // landscape split: кольцо заметно меньше, как раньше
  // portrait: больше, но не oversized
  const k = row ? 0.39 : 0.7;

  const maxPx = row ? 340 : 430;
  const minPx = row ? 150 : 170;

  return Math.round(clamp(limitingSide * k, minPx, maxPx));
}

function applyGoFontScale(displayEl, ringPx) {
  if (!displayEl) return;
  const rem = ringPx * 0.24;
  const px = clamp(rem, 44, 92);
  displayEl.style.setProperty("--go-font-dynamic", `${px}px`);
}

function updateRingSizeAndGoFont(wrap, displays) {
  if (!wrap) return;
  const px = calcDynamicRingSizePx(wrap);
  if (px <= 0) return;

  wrap.style.setProperty("--ring-size-dynamic", `${px}px`);
  displays.forEach((el) => applyGoFontScale(el, px));
}

function centerGoDisplay(displayEl) {
  if (!displayEl) return;

  const text = String(displayEl.textContent || "")
    .trim()
    .toUpperCase();
  const isGo = displayEl.classList.contains("is-go") && text === "GO";

  if (!isGo) {
    displayEl.style.setProperty("--go-nudge-x", "0px");
    displayEl.style.setProperty("--go-nudge-y", "0px");
    return;
  }

  const host = displayEl.closest("button");
  if (!host) return;

  const hostRect = host.getBoundingClientRect();
  const textRect = displayEl.getBoundingClientRect();

  const hostCx = hostRect.left + hostRect.width / 2;
  const hostCy = hostRect.top + hostRect.height / 2;
  const textCx = textRect.left + textRect.width / 2;
  const textCy = textRect.top + textRect.height / 2;

  const dx = clamp(hostCx - textCx, -8, 8);
  const dy = clamp(hostCy - textCy, -8, 8);

  displayEl.style.setProperty("--go-nudge-x", `${dx.toFixed(2)}px`);
  displayEl.style.setProperty("--go-nudge-y", `${dy.toFixed(2)}px`);
}

export function initDynamicRingAndGoLayout() {
  const wraps = Array.from(document.querySelectorAll(".timer-circle-wrap"));

  const displays = [
    document.getElementById("sw-mainDisplay"),
    document.getElementById("tm-mainDisplay"),
    document.getElementById("tb-mainTimer"),
  ].filter(Boolean);

  const refreshAll = () => {
    wraps.forEach((w) => updateRingSizeAndGoFont(w, displays));
    displays.forEach(centerGoDisplay);
  };

  refreshAll();

  const ro = new ResizeObserver(refreshAll);
  wraps.forEach((w) => {
    ro.observe(w);
    const topHalf = getTopHalfEl(w);
    if (topHalf) ro.observe(topHalf);
  });
  displays.forEach((d) => ro.observe(d));

  const textObs = displays.map((d) => {
    const mo = new MutationObserver(() => centerGoDisplay(d));
    mo.observe(d, {
      characterData: true,
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return mo;
  });

  window.addEventListener("resize", refreshAll, { passive: true });
  window.addEventListener("orientationchange", refreshAll, { passive: true });

  return () => {
    ro.disconnect();
    textObs.forEach((o) => o.disconnect());
    window.removeEventListener("resize", refreshAll);
    window.removeEventListener("orientationchange", refreshAll);
  };
}
