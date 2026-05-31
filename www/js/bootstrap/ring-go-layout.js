// Файл: www/js/bootstrap/ring-go-layout.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function snap4(px) {
  return Math.round(px / 4) * 4;
}

function getTopHalfEl(wrap) {
  return wrap.closest(".view-top-half");
}

function getViewElFromWrap(wrap) {
  return wrap.closest("#view-stopwatch, #view-timer, #view-tabata");
}

function getRingWrapForDisplay(displayEl) {
  if (!displayEl) return null;
  return displayEl.closest(".timer-circle-wrap");
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
    return snap4(clamp(fallback * 0.68, 172, 420));
  }

  const limitingSide = Math.min(rect.width, rect.height);
  const row = isRowLayout(topHalfEl);

  const k = row ? 0.64 : 0.92;
  const maxPx = row ? 580 : 680;
  const minPx = row ? 232 : 220;

  return snap4(clamp(limitingSide * k, minPx, maxPx));
}

function estimateInnerRingAreaPx(ringPx) {
  // Sync with CSS ring-safe-gap clamp(10px, 3.2cqi, 18px)
  const ringSafeGap = clamp(ringPx * 0.055, 10, 18);
  // ring-stroke-width usually 4, but allow some variability
  const stroke = clamp(4, 2, 10);
  const inner = ringPx - (ringSafeGap + stroke + 2) * 2;
  return Math.max(1, inner);
}

function computeGoFontPx(ringPx) {
  // Стабильная пропорция относительно визуального диаметра кольца.
  // 0.235 дает одинаковое ощущение на телефоне/планшете/десктопе.
  const px = ringPx * 0.235;
  return snap4(clamp(px, 44, 112));
}

function applyDisplayScale(displayEl, ringPx, rowLayout) {
  if (!displayEl || !ringPx) return;

  const text = String(displayEl.textContent || "").trim();
  const isGo =
    displayEl.classList.contains("is-go") && text.toUpperCase() === "GO";

  if (isGo) {
    const goPx = computeGoFontPx(ringPx);
    displayEl.style.setProperty("--go-font-dynamic", `${goPx}px`);
    displayEl.style.setProperty("--go-skew-deg", "-11deg");
    return;
  }

  const hasMs = text.includes(".");
  const base = rowLayout ? (hasMs ? 0.132 : 0.152) : hasMs ? 0.124 : 0.144;
  const rawTimer = ringPx * base;
  const timerPx = snap4(clamp(rawTimer, 24, rowLayout ? 60 : 56));

  displayEl.style.setProperty("--timer-font-dynamic", `${timerPx}px`);
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

  displayEl.style.setProperty("--go-nudge-x", "0px");
  displayEl.style.setProperty("--go-nudge-y", "0px");

  const hostRect = host.getBoundingClientRect();
  const textRect = displayEl.getBoundingClientRect();

  const hostCx = hostRect.left + hostRect.width / 2;
  const hostCy = hostRect.top + hostRect.height / 2;
  const textCx = textRect.left + textRect.width / 2;
  const textCy = textRect.top + textRect.height / 2;

  const fontPx = parseFloat(getComputedStyle(displayEl).fontSize) || 0;

  // Минимальная и стабильная оптическая компенсация для skew.
  const opticalCompX = clamp(fontPx * 0.018, 0.4, 1.8);
  const opticalCompY = -clamp(fontPx * 0.006, 0.2, 1.1);

  const dx = clamp(hostCx - textCx + opticalCompX, -6, 6);
  const dy = clamp(hostCy - textCy + opticalCompY, -6, 6);

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

  if (!wraps.length && !displays.length) {
    return () => {};
  }

  let rafId = 0;
  let splitTrackRaf = 0;
  let splitTrackUntil = 0;

  const refreshNow = () => {
    rafId = 0;

    wraps.forEach((wrap) => {
      const px = calcDynamicRingSizePx(wrap);
      if (px <= 0) return;

      wrap.style.setProperty("--ring-size-dynamic", `${px}px`);

      const topHalf = getTopHalfEl(wrap);
      const rowLayout = isRowLayout(topHalf);

      displays.forEach((displayEl) => {
        const ownWrap = getRingWrapForDisplay(displayEl);
        if (ownWrap === wrap) {
          applyDisplayScale(displayEl, px, rowLayout);
        }
      });
    });

    displays.forEach((displayEl) => {
      if (!getRingWrapForDisplay(displayEl)) {
        applyDisplayScale(displayEl, 320, false);
      }
      centerGoDisplay(displayEl);
    });
  };

  const scheduleRefresh = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(refreshNow);
  };

  const startSplitTracking = (durationMs = 420) => {
    splitTrackUntil = performance.now() + durationMs;

    if (splitTrackRaf) return;

    const loop = () => {
      splitTrackRaf = 0;
      scheduleRefresh();

      if (performance.now() < splitTrackUntil) {
        splitTrackRaf = requestAnimationFrame(loop);
      }
    };

    splitTrackRaf = requestAnimationFrame(loop);
  };

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleRefresh)
      : null;

  wraps.forEach((wrap) => {
    ro?.observe(wrap);
    const topHalf = getTopHalfEl(wrap);
    if (topHalf) ro?.observe(topHalf);
  });

  displays.forEach((displayEl) => {
    ro?.observe(displayEl);
    const host = displayEl.closest("button");
    if (host) ro?.observe(host);
  });

  const textObservers = displays.map((displayEl) => {
    const mo = new MutationObserver(scheduleRefresh);
    mo.observe(displayEl, {
      characterData: true,
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return mo;
  });

  const onResize = () => scheduleRefresh();
  const onOrientation = () => {
    startSplitTracking(520);
    scheduleRefresh();
  };

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onOrientation, {
    passive: true,
  });

  if (document.fonts?.ready) {
    document.fonts.ready
      .then(() => {
        startSplitTracking(320);
        scheduleRefresh();
      })
      .catch(() => {});
  }

  if (document.fonts?.addEventListener) {
    document.fonts.addEventListener("loadingdone", scheduleRefresh);
    document.fonts.addEventListener("loadingerror", scheduleRefresh);
  }

  const splitViews = Array.from(
    new Set(wraps.map((w) => getViewElFromWrap(w)).filter(Boolean)),
  );

  const onSplitTransitionStart = () => {
    startSplitTracking(520);
  };

  const onSplitTransitionEnd = () => {
    startSplitTracking(180);
  };

  splitViews.forEach((viewEl) => {
    viewEl.addEventListener("transitionrun", onSplitTransitionStart);
    viewEl.addEventListener("transitionstart", onSplitTransitionStart);
    viewEl.addEventListener("transitionend", onSplitTransitionEnd);
    viewEl.addEventListener("transitioncancel", onSplitTransitionEnd);
  });

  scheduleRefresh();

  return () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    if (splitTrackRaf) {
      cancelAnimationFrame(splitTrackRaf);
      splitTrackRaf = 0;
    }

    ro?.disconnect();
    textObservers.forEach((o) => o.disconnect());

    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onOrientation);

    if (document.fonts?.removeEventListener) {
      document.fonts.removeEventListener("loadingdone", scheduleRefresh);
      document.fonts.removeEventListener("loadingerror", scheduleRefresh);
    }

    splitViews.forEach((viewEl) => {
      viewEl.removeEventListener("transitionrun", onSplitTransitionStart);
      viewEl.removeEventListener("transitionstart", onSplitTransitionStart);
      viewEl.removeEventListener("transitionend", onSplitTransitionEnd);
      viewEl.removeEventListener("transitioncancel", onSplitTransitionEnd);
    });
  };
}
