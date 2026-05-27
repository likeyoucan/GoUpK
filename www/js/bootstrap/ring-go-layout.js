// Файл: www/js/bootstrap/ring-go-layout.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getTopHalfRect(wrap) {
  const topHalf = wrap.closest(".view-top-half");
  if (!topHalf) return null;
  return topHalf.getBoundingClientRect();
}

// База: кольцо всегда ограничиваем меньшей стороной view-top-half
function calcDynamicRingSizePx(wrap) {
  const topRect = getTopHalfRect(wrap);
  if (!topRect) {
    const fallback = Math.min(wrap.clientWidth || 0, wrap.clientHeight || 0);
    return Math.round(clamp(fallback * 0.9, 188, 680));
  }

  const limitingSide = Math.min(topRect.width, topRect.height);
  const size = limitingSide * 0.86; // мягкий внутренний отступ под title/action rails
  return Math.round(clamp(size, 188, 680));
}

function updateRingSize(wrap) {
  if (!wrap) return;
  const px = calcDynamicRingSizePx(wrap);
  if (px > 0) {
    wrap.style.setProperty("--ring-size-dynamic", `${px}px`);
  }
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
    wraps.forEach(updateRingSize);
    displays.forEach(centerGoDisplay);
  };

  refreshAll();

  const resizeObserver = new ResizeObserver(() => {
    refreshAll();
  });

  wraps.forEach((w) => {
    resizeObserver.observe(w);
    const topHalf = w.closest(".view-top-half");
    if (topHalf) resizeObserver.observe(topHalf);
  });

  displays.forEach((d) => resizeObserver.observe(d));

  const textObservers = displays.map((displayEl) => {
    const mo = new MutationObserver(() => centerGoDisplay(displayEl));
    mo.observe(displayEl, {
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
    resizeObserver.disconnect();
    textObservers.forEach((o) => o.disconnect());
    window.removeEventListener("resize", refreshAll);
    window.removeEventListener("orientationchange", refreshAll);
  };
}
