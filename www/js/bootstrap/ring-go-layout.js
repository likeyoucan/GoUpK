// Файл: www/js/bootstrap/ring-go-layout.js

import {
  calcDynamicRingSizePx,
  getRenderedRingPx,
  getRingWrapForDisplay,
  getTopHalfEl,
  getViewElFromWrap,
} from "./ring-go-layout/geometry.js?v=VERSION";
import {
  applyMetaTextScale,
  applyDisplayScale,
} from "./ring-go-layout/scale.js?v=VERSION";
import {
  isGoDisplay,
  getDisplayState,
  setDisplayState,
  triggerGoEnter,
  triggerTimeEnter,
  centerGoDisplay,
  resetGoNudges,
} from "./ring-go-layout/go-center.js?v=VERSION";

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

  // Filled later, but declared early so refreshNow can safely read it.
  let splitViews = [];

  let rafId = 0;
  let splitTrackRaf = 0;
  let splitTrackUntil = 0;
  let settleCenterRaf = 0;
  let needsSettleCenter = false;

  const refreshNow = () => {
    rafId = 0;

    const app = document.getElementById("app");
    if (app?.classList.contains("is-view-transitioning")) return;

    const isAnySplitAnimating = splitViews.some((v) =>
      v.classList.contains("split-animating"),
    );

    wraps.forEach((wrap) => {
      const px = calcDynamicRingSizePx(wrap);
      if (px <= 0) return;

      wrap.style.setProperty("--ring-size-dynamic", `${px.toFixed(2)}px`);
      const renderedRingPx = getRenderedRingPx(wrap, px);

      applyMetaTextScale(wrap, renderedRingPx);

      displays.forEach((displayEl) => {
        const ownWrap = getRingWrapForDisplay(displayEl);
        if (ownWrap === wrap) {
          applyDisplayScale(displayEl, px, renderedRingPx);
        }
      });
    });

    displays.forEach((displayEl) => {
      if (!getRingWrapForDisplay(displayEl)) {
        applyDisplayScale(displayEl, 320, 320);
      }
    });

    // Heavy path: avoid centering GO while split is actively animating.
    // It can trigger extra layout work and frame spikes.
    if (isAnySplitAnimating) {
      needsSettleCenter = true;
      return;
    }

    displays.forEach((displayEl) => {
      centerGoDisplay(displayEl);
    });

    if (!needsSettleCenter) return;

    needsSettleCenter = false;

    if (settleCenterRaf) cancelAnimationFrame(settleCenterRaf);
    settleCenterRaf = requestAnimationFrame(() => {
      settleCenterRaf = 0;
      displays.forEach((displayEl) => centerGoDisplay(displayEl));
    });
  };

  const scheduleRefresh = ({ settleCenter = false } = {}) => {
    if (settleCenter) needsSettleCenter = true;
    if (rafId) return;
    rafId = requestAnimationFrame(refreshNow);
  };

  const startSplitTracking = (durationMs = 420) => {
    splitTrackUntil = performance.now() + durationMs;
    if (splitTrackRaf) return;

    const loop = () => {
      splitTrackRaf = 0;
      scheduleRefresh({ settleCenter: false });

      if (performance.now() < splitTrackUntil) {
        splitTrackRaf = requestAnimationFrame(loop);
      }
    };

    splitTrackRaf = requestAnimationFrame(loop);
  };

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => scheduleRefresh({ settleCenter: false }))
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
    setDisplayState(displayEl, {
      wasGo: isGoDisplay(displayEl),
      text: String(displayEl.textContent || "").trim(),
    });
  });

  requestAnimationFrame(() => {
    displays.forEach((displayEl) => {
      if (isGoDisplay(displayEl)) triggerGoEnter(displayEl);
    });
  });

  const handleDisplayMutation = (displayEl) => {
    const prev = getDisplayState(displayEl);
    const text = String(displayEl.textContent || "").trim();
    const nowGo = isGoDisplay(displayEl);

    if (nowGo && !prev.wasGo) {
      triggerGoEnter(displayEl);
    } else if (!nowGo && prev.wasGo) {
      requestAnimationFrame(() => {
        if (!isGoDisplay(displayEl)) triggerTimeEnter(displayEl);
      });
    } else if (text !== prev.text && !nowGo) {
      triggerTimeEnter(displayEl);
    }

    setDisplayState(displayEl, { wasGo: nowGo, text });

    startSplitTracking(120);
    scheduleRefresh({ settleCenter: false });
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
    resetGoNudges(displays);
    startSplitTracking(300);
    scheduleRefresh({ settleCenter: true });
  };

  const onOrientation = () => {
    resetGoNudges(displays);
    startSplitTracking(520);
    scheduleRefresh({ settleCenter: true });
  };

  const onMsChanged = () => {
    startSplitTracking(120);
    scheduleRefresh({ settleCenter: false });
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
        scheduleRefresh({ settleCenter: true });
      })
      .catch(() => {});
  }

  const onFontsChanged = () => scheduleRefresh({ settleCenter: true });

  if (document.fonts?.addEventListener) {
    document.fonts.addEventListener("loadingdone", onFontsChanged);
    document.fonts.addEventListener("loadingerror", onFontsChanged);
  }

  splitViews = Array.from(
    new Set(wraps.map((w) => getViewElFromWrap(w)).filter(Boolean)),
  );

  const onSplitTransitionStart = () => {
    startSplitTracking(520);
    scheduleRefresh({ settleCenter: false });
  };

  const onSplitTransitionEnd = () => {
    startSplitTracking(180);
    scheduleRefresh({ settleCenter: true });
  };

  splitViews.forEach((viewEl) => {
    viewEl.addEventListener("transitionrun", onSplitTransitionStart);
    viewEl.addEventListener("transitionstart", onSplitTransitionStart);
    viewEl.addEventListener("transitionend", onSplitTransitionEnd);
    viewEl.addEventListener("transitioncancel", onSplitTransitionEnd);
  });

  scheduleRefresh({ settleCenter: true });

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
      document.fonts.removeEventListener("loadingdone", onFontsChanged);
      document.fonts.removeEventListener("loadingerror", onFontsChanged);
    }

    splitViews.forEach((viewEl) => {
      viewEl.removeEventListener("transitionrun", onSplitTransitionStart);
      viewEl.removeEventListener("transitionstart", onSplitTransitionStart);
      viewEl.removeEventListener("transitionend", onSplitTransitionEnd);
      viewEl.removeEventListener("transitioncancel", onSplitTransitionEnd);
    });
  };
}
