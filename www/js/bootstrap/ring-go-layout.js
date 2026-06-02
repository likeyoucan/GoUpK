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

function isCompactViewport() {
  return window.innerHeight < 430 || window.innerWidth < 280;
}

function isCompactRing(ringPx) {
  return ringPx < 180 || isCompactViewport();
}

function calcDynamicRingSizePx(wrap) {
  const topHalfEl = getTopHalfEl(wrap);
  const rect = topHalfEl?.getBoundingClientRect?.();

  if (!rect) {
    const fallback = Math.min(wrap.clientWidth || 0, wrap.clientHeight || 0);
    const row = isRowLayout(topHalfEl);
    const isMobilePortrait = window.matchMedia(
      "(max-width: 767px) and (orientation: portrait)",
    ).matches;

    // Keep compact fallback only for mobile portrait.
    if (isMobilePortrait) {
      return snap4(clamp(fallback * 0.62, 148, 380));
    }

    // Preserve old behavior for two-column / desktop flows.
    return snap4(clamp(fallback * 0.68, 172, row ? 580 : 680));
  }

  const limitingSide = Math.min(rect.width, rect.height);
  const row = isRowLayout(topHalfEl);

  const isMobilePortrait = window.matchMedia(
    "(max-width: 767px) and (orientation: portrait)",
  ).matches;

  // Portrait mobile compact ring only.
  let k = row ? 0.64 : 0.92;
  if (isMobilePortrait) {
    k = 0.8;
  }

  const maxPx = row ? 580 : isMobilePortrait ? 560 : 680;
  const minPx = row ? 200 : isMobilePortrait ? 180 : 220;

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

function applyMetaTextScale(wrap, ringPx, rowLayout) {
  if (!wrap || !ringPx) return;

  const compact = isCompactRing(ringPx);

  const metaFontPx = snap2(
    clamp(
      ringPx *
        (compact ? (rowLayout ? 0.05 : 0.052) : rowLayout ? 0.062 : 0.058),
      compact ? 9 : 11,
      compact ? 14 : rowLayout ? 20 : 24,
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

  wrap.style.setProperty("--ring-meta-font-px", `${metaFontPx}px`);
  wrap.style.setProperty("--ring-status-offset-px", `${statusOffsetPx}px`);
  wrap.style.setProperty("--ring-extended-offset-px", `${extendedOffsetPx}px`);
}

function applyDisplayScale(displayEl, ringPx, rowLayout, renderedRingPx) {
  if (!displayEl || !ringPx) return;

  const text = String(displayEl.textContent || "").trim();
  const isGo =
    displayEl.classList.contains("is-go") && text.toUpperCase() === "GO";

  if (isGo) {
    const ringForGo = renderedRingPx || ringPx;
    const compact = isCompactRing(ringForGo);

    // GO always scales from real ring size.
    const minGo = compact ? 28 : rowLayout ? 44 : 48;
    const maxGo = compact ? 76 : rowLayout ? 132 : 168;

    let goPx = ringForGo * 0.258;
    goPx = clamp(goPx, minGo, maxGo);

    displayEl.style.setProperty("--go-skew-deg", "-11deg");

    // Mild normalization across browser/device font metrics.
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

  const base = compact
    ? hasMs
      ? 0.17
      : 0.19
    : rowLayout
      ? hasMs
        ? 0.15
        : 0.175
      : hasMs
        ? 0.145
        : 0.17;

  const rawTimer = ringPx * base;
  const timerPx = snap2(
    clamp(rawTimer, compact ? 12 : 24, compact ? 40 : rowLayout ? 88 : 108),
  );

  displayEl.style.setProperty("--timer-font-dynamic", `${timerPx}px`);
}

function centerGoDisplay(displayEl) {
  if (!displayEl) return;

  const wrap = getRingWrapForDisplay(displayEl);
  const rect = wrap?.getBoundingClientRect?.();
  const ringPx = rect ? Math.min(rect.width || 0, rect.height || 0) : 0;
  const compact = ringPx > 0 && ringPx < 220;

  // Optical vertical center correction for italic/skewed GO glyph.
  const y = compact ? -2 : -3;

  displayEl.style.setProperty("--go-nudge-x", "0px");
  displayEl.style.setProperty("--go-nudge-y", `${y}px`);
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

      // Scale PAUSE / extended day-hour text relative to ring size.
      applyMetaTextScale(wrap, renderedRingPx, rowLayout);

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
