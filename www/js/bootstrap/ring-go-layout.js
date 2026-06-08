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

function isGoDisplay(displayEl) {
  if (!displayEl) return false;
  const text = String(displayEl.textContent || "")
    .trim()
    .toUpperCase();
  return displayEl.classList.contains("is-go") && text === "GO";
}

function triggerGoEnter(displayEl) {
  if (!isGoDisplay(displayEl)) return;
  displayEl.classList.remove("go-enter");
  void displayEl.offsetWidth;
  displayEl.classList.add("go-enter");
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

    if (isMobilePortrait) {
      return snap4(clamp(fallback * 0.62, 148, 380));
    }

    return snap4(clamp(fallback * 0.68, 172, row ? 580 : 680));
  }

  const limitingSide = Math.min(rect.width, rect.height);
  const row = isRowLayout(topHalfEl);

  const isMobilePortrait = window.matchMedia(
    "(max-width: 767px) and (orientation: portrait)",
  ).matches;

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

function applyDisplayScale(displayEl, ringPx, rowLayout, renderedRingPx) {
  if (!displayEl || !ringPx) return;

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

  const rawTimer = ringPx * base;
  const minPx = compact ? 10 : rowLayout ? 12 : 14;
  const hardMaxPx = compact ? 36 : rowLayout ? 64 : 84;
  const ratioMaxPx = ringPx * (hasMs ? 0.24 : 0.27);

  const timerPx = snap2(
    clamp(rawTimer, minPx, Math.min(hardMaxPx, ratioMaxPx)),
  );

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
    displayEl.dataset.goNudgeX = "0";
    displayEl.dataset.goNudgeY = "0";
    return;
  }

  const wrap = getRingWrapForDisplay(displayEl);
  const wrapRect = wrap?.getBoundingClientRect?.();
  if (!wrapRect || !wrapRect.width || !wrapRect.height) return;

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
  if (!txtRect || !txtRect.width || !txtRect.height) return;

  const wrapCx = wrapRect.left + wrapRect.width / 2;
  const wrapCy = wrapRect.top + wrapRect.height / 2;
  const txtCx = txtRect.left + txtRect.width / 2;
  const txtCy = txtRect.top + txtRect.height / 2;

  let dx = wrapCx - txtCx;
  let dy = wrapCy - txtCy;

  // Optical correction for skewed GO baseline.
  const opticalUp = Math.max(1.5, txtRect.height * 0.06);
  dy -= opticalUp;

  const prevX = Number(displayEl.dataset.goNudgeX || "0");
  const prevY = Number(displayEl.dataset.goNudgeY || "0");

  let nextX = snap2(clamp(prevX + dx, -36, 36));
  let nextY = snap2(clamp(prevY + dy, -36, 36));

  if (Math.abs(dx) < 0.08) nextX = prevX;
  if (Math.abs(dy) < 0.08) nextY = prevY;

  if (nextX === prevX && nextY === prevY) return;

  displayEl.style.setProperty("--go-nudge-x", `${nextX}px`);
  displayEl.style.setProperty("--go-nudge-y", `${nextY}px`);
  displayEl.dataset.goNudgeX = String(nextX);
  displayEl.dataset.goNudgeY = String(nextY);
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
  let settleCenterRaf = 0;

  const refreshNow = () => {
    rafId = 0;

    const app = document.getElementById("app");
    if (app?.classList.contains("is-view-transitioning")) return;

    wraps.forEach((wrap) => {
      const px = calcDynamicRingSizePx(wrap);
      if (px <= 0) return;

      wrap.style.setProperty("--ring-size-dynamic", `${px.toFixed(2)}px`);
      const renderedRingPx = getRenderedRingPx(wrap, px);

      const topHalf = getTopHalfEl(wrap);
      const rowLayout = isRowLayout(topHalf);

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

    // Second pass after browser settles glyph metrics/paint.
    if (settleCenterRaf) cancelAnimationFrame(settleCenterRaf);
    settleCenterRaf = requestAnimationFrame(() => {
      settleCenterRaf = 0;
      displays.forEach((displayEl) => centerGoDisplay(displayEl));
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

  displays.forEach((displayEl) => {
    displayEl.dataset.wasGo = isGoDisplay(displayEl) ? "1" : "0";
  });

  const handleDisplayMutation = (displayEl) => {
    const wasGo = displayEl.dataset.wasGo === "1";
    const nowGo = isGoDisplay(displayEl);

    if (nowGo && !wasGo) {
      triggerGoEnter(displayEl);
    }

    displayEl.dataset.wasGo = nowGo ? "1" : "0";
    startSplitTracking(120);
    scheduleRefresh();
  };

  const classObservers = displays.map((displayEl) => {
    const mo = new MutationObserver(() => handleDisplayMutation(displayEl));
    mo.observe(displayEl, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return mo;
  });

  const textObservers = displays.map((displayEl) => {
    const mo = new MutationObserver(() => handleDisplayMutation(displayEl));

    mo.observe(displayEl, {
      characterData: true,
      childList: true,
      subtree: true,
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

  const onMsChanged = () => {
    startSplitTracking(120);
    scheduleRefresh();
  };

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onOrientation, {
    passive: true,
  });
  document.addEventListener("msChanged", onMsChanged);

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

    if (settleCenterRaf) {
      cancelAnimationFrame(settleCenterRaf);
      settleCenterRaf = 0;
    }

    ro?.disconnect();
    classObservers.forEach((o) => o.disconnect());
    textObservers.forEach((o) => o.disconnect());

    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onOrientation);
    document.removeEventListener("msChanged", onMsChanged);

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
