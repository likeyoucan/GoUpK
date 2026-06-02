// Файл: www/js/bootstrap/ring-go-layout.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function snap2(px) {
  return Math.round(px * 2) / 2;
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
  const minPx = row ? 220 : 220;

  return snap4(clamp(limitingSide * k, minPx, maxPx));
}

function getRenderedRingPx(wrap, fallback) {
  const r = wrap.getBoundingClientRect();
  const v = Math.min(r.width || 0, r.height || 0);
  return v > 0 ? v : fallback;
}

function setGoFontStable(displayEl, nextPx) {
  const prev = Number(displayEl.dataset.goFontPx || "0");

  // Ignore tiny fluctuations that cause visual jitter.
  if (prev > 0 && Math.abs(nextPx - prev) < 0.8) {
    return;
  }

  displayEl.style.setProperty("--go-font-dynamic", `${nextPx}px`);
  displayEl.dataset.goFontPx = String(nextPx);
}

function applyDisplayScale(displayEl, ringPx, rowLayout, renderedRingPx) {
  if (!displayEl || !ringPx) return;

  const text = String(displayEl.textContent || "").trim();
  const isGo =
    displayEl.classList.contains("is-go") && text.toUpperCase() === "GO";

  if (isGo) {
    const ringForGo = renderedRingPx || ringPx;

    // GO всегда масштабируется от фактического размера кольца.
    // Отдельные лимиты для row/column layout.
    const minGo = rowLayout ? 44 : 48;
    const maxGo = rowLayout ? 132 : 168;

    let goPx = ringForGo * 0.258;
    goPx = clamp(goPx, minGo, maxGo);

    displayEl.style.setProperty("--go-skew-deg", "-11deg");

    // Мягкая корректировка метрик шрифта без жесткого "зажатия" размера.
    const renderedWordW = displayEl.getBoundingClientRect().width || 0;
    if (renderedWordW > 0) {
      const targetWordW = ringForGo * 0.355;
      const k = clamp(targetWordW / renderedWordW, 0.9, 1.12);
      goPx = clamp(goPx * k, minGo, maxGo);
    }

    goPx = snap2(goPx);
    setGoFontStable(displayEl, goPx);
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

  // Deterministic center to avoid transition jitter.
  displayEl.style.setProperty("--go-nudge-x", "0px");
  displayEl.style.setProperty("--go-nudge-y", "0px");
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

    // Do not recompute in the middle of nav snapshot transition.
    const app = document.getElementById("app");
    if (app?.classList.contains("is-view-transitioning")) return;

    wraps.forEach((wrap) => {
      const px = calcDynamicRingSizePx(wrap);
      if (px <= 0) return;

      wrap.style.setProperty("--ring-size-dynamic", `${px.toFixed(2)}px`);
      const renderedRingPx = getRenderedRingPx(wrap, px);

      const topHalf = getTopHalfEl(wrap);
      const rowLayout = isRowLayout(topHalf);

      displays.forEach((displayEl) => {
        const ownWrap = getRingWrapForDisplay(displayEl);
        if (ownWrap === wrap) {
          applyDisplayScale(displayEl, px, rowLayout, renderedRingPx);
        }
      });
    });

    displays.forEach((displayEl) => {
      if (!getRingWrapForDisplay(displayEl)) {
        applyDisplayScale(displayEl, 320, false, 320);
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

  const classObservers = displays.map((displayEl) => {
    const mo = new MutationObserver(scheduleRefresh);
    mo.observe(displayEl, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return mo;
  });

  const onResize = () => {
    startSplitTracking(300);
    scheduleRefresh();
  };

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
        startSplitTracking(260);
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

  const onSplitTransitionStart = () => startSplitTracking(520);
  const onSplitTransitionEnd = () => {
    startSplitTracking(180);
    scheduleRefresh();
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
    classObservers.forEach((o) => o.disconnect());

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
