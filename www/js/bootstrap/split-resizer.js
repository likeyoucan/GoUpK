// Файл: www/js/bootstrap/split-resizer.js

const VIEW_IDS = ["view-stopwatch", "view-timer", "view-tabata"];
let views = [];
let detachViewportListeners = null;

let globalSnap = "middle"; // "top" | "middle" | "bottom"

// Explicit behavior when bottom is hidden in landscape.
// true: bottom is treated as overlay layer (CSS reads data-split-overlay-bottom="1")
const SPLIT_BEHAVIOR = {
  overlayWhenBottomHidden: true,
};

// Viewport policy to prevent layout collapse on extreme ratios.
const VIEWPORT_POLICY = {
  emergencyHeightMax: 320,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function isRowLayout(viewEl) {
  return getComputedStyle(viewEl).flexDirection.startsWith("row");
}

function isMobilePortrait() {
  return (
    window.matchMedia("(max-width: 767px)").matches &&
    window.matchMedia("(orientation: portrait)").matches
  );
}

function getMiddleAnchor() {
  return isMobilePortrait() ? 60 : 50;
}

/**
 * Returns forced target for current viewport:
 * - 100: ultra compact (show top, hide bottom)
 * - middle: compact range (stable split)
 * - null: normal behavior
 */
function getForcedTargetForViewport() {
  const h = window.innerHeight || 0;

  // Форс только в аварийном кейсе.
  // В обычных low-res split должен быть полностью draggable.
  if (h <= VIEWPORT_POLICY.emergencyHeightMax) {
    return getMiddleAnchor();
  }

  return null;
}

function normalizeTargetForViewport(target) {
  const forced = getForcedTargetForViewport();
  return forced == null ? target : forced;
}

function nearestAnchor(value, anchors) {
  let best = anchors[0];
  let bestDist = Math.abs(value - best);

  for (let i = 1; i < anchors.length; i += 1) {
    const d = Math.abs(value - anchors[i]);
    if (d < bestDist) {
      bestDist = d;
      best = anchors[i];
    }
  }

  return best;
}

function setStateClass(viewEl, target) {
  viewEl.classList.remove(
    "split-top-hidden",
    "split-middle",
    "split-bottom-hidden",
  );
  if (target === 0) viewEl.classList.add("split-top-hidden");
  else if (target === 100) viewEl.classList.add("split-bottom-hidden");
  else viewEl.classList.add("split-middle");
}

function setCollapseFx(viewEl, raw) {
  const middle = getMiddleAnchor();

  const topLinear = clamp((middle - raw) / middle, 0, 1);
  const bottomLinear = clamp((raw - middle) / (100 - middle), 0, 1);

  const topK = Math.pow(topLinear, 1.15);
  const bottomK = Math.pow(bottomLinear, 1.15);

  viewEl.style.setProperty("--collapse-top-k", topK.toFixed(3));
  viewEl.style.setProperty("--collapse-bottom-k", bottomK.toFixed(3));
}

function setHandlerA11y(handler, snapValue) {
  const middle = getMiddleAnchor();
  const normalized = snapValue === middle ? middle : snapValue === 0 ? 0 : 100;

  handler.setAttribute("role", "slider");
  handler.setAttribute("aria-valuemin", "0");
  handler.setAttribute("aria-valuemax", "100");
  handler.setAttribute("aria-valuenow", String(normalized));
  handler.setAttribute(
    "aria-valuetext",
    normalized === middle ? `middle ${middle}%` : `${normalized}%`,
  );
}

function getTargetFromGlobalSnap() {
  const middle = getMiddleAnchor();

  let target = middle;
  if (globalSnap === "top") target = 0;
  else if (globalSnap === "bottom") target = 100;

  return normalizeTargetForViewport(target);
}

function applyOverlayFlag(viewEl, target, { liveRaw = null } = {}) {
  if (!SPLIT_BEHAVIOR.overlayWhenBottomHidden) {
    viewEl.dataset.splitOverlayBottom = "0";
    return;
  }

  if (!isRowLayout(viewEl)) {
    viewEl.dataset.splitOverlayBottom = "0";
    return;
  }

  if (target === 100) {
    viewEl.dataset.splitOverlayBottom = "1";
    return;
  }

  if (typeof liveRaw === "number" && liveRaw >= 94) {
    viewEl.dataset.splitOverlayBottom = "1";
    return;
  }

  viewEl.dataset.splitOverlayBottom = "0";
}

function updateAllA11y() {
  const target = getTargetFromGlobalSnap();
  views.forEach((v) => {
    if (v.handler) setHandlerA11y(v.handler, target);
  });
}

function applySnapToAll(target, { animate = true, duration = 240 } = {}) {
  const forcedTarget = getForcedTargetForViewport();

  if (forcedTarget != null) {
    target = forcedTarget;
  }

  const forcedMiddle =
    forcedTarget !== null && forcedTarget !== 0 && forcedTarget !== 100;

  if (forcedMiddle) {
    target = getMiddleAnchor();
  }

  const middle = getMiddleAnchor();
  const visualTarget = target === 0 ? 0.15 : target === 100 ? 99.85 : middle;
  const targetName =
    target === 0 ? "top" : target === 100 ? "bottom" : "middle";

  views.forEach(({ viewEl, topHalf }) => {
    if (!viewEl || !topHalf) return;

    viewEl.classList.toggle("split-force-middle", forcedMiddle);

    viewEl.dataset.splitTarget = targetName;
    applyOverlayFlag(viewEl, target);

    if (!animate) {
      viewEl.classList.remove("split-live", "split-animating");
      viewEl.style.setProperty("--split", `${visualTarget}%`);
      setStateClass(viewEl, target);
      setCollapseFx(viewEl, target === 0 ? 0 : target === 100 ? 100 : middle);
      viewEl.dataset.splitTarget = "";
      return;
    }

    viewEl.style.setProperty("--split-snap-duration", `${duration}ms`);
    viewEl.classList.remove("split-live");
    viewEl.classList.add("split-animating");

    setStateClass(viewEl, middle);
    viewEl.style.setProperty("--split", `${visualTarget}%`);
    setCollapseFx(viewEl, visualTarget);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      viewEl.classList.remove("split-animating");
      setStateClass(viewEl, target);
      setCollapseFx(viewEl, target === 0 ? 0 : target === 100 ? 100 : middle);
      applyOverlayFlag(viewEl, target);
      viewEl.dataset.splitTarget = "";
    };

    const onEnd = (e) => {
      if (e.target !== topHalf || e.propertyName !== "flex-basis") return;
      topHalf.removeEventListener("transitionend", onEnd);
      finish();
    };

    topHalf.addEventListener("transitionend", onEnd);
    setTimeout(() => {
      topHalf.removeEventListener("transitionend", onEnd);
      finish();
    }, duration + 90);
  });

  globalSnap = targetName;
  updateAllA11y();
}

function getInertiaTuning(pointerType) {
  if (pointerType === "mouse") {
    return { gain: 55, maxShift: 4, keep: 0.9, add: 0.1, duration: 220 };
  }
  if (pointerType === "pen") {
    return { gain: 90, maxShift: 7, keep: 0.82, add: 0.18, duration: 240 };
  }
  return { gain: 130, maxShift: 9, keep: 0.76, add: 0.24, duration: 280 };
}

function setupOneView(ctx) {
  const { viewEl, handler } = ctx;
  if (!viewEl || !handler) return;

  const SNAP_THRESHOLD = 10;
  let dragging = false;
  let activePointerType = "touch";
  let lastRaw = getTargetFromGlobalSnap();

  let lastTs = 0;
  let lastRawForVel = lastRaw;
  let velocity = 0;
  let tapTimer = null;

  const getAnchors = () => {
    const forced = getForcedTargetForViewport();
    if (forced != null) return [forced];
    return [0, getMiddleAnchor(), 100];
  };

  const pointerToRaw = (ev) => {
    const rect = viewEl.getBoundingClientRect();

    if (isRowLayout(viewEl)) {
      return clamp(
        ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100,
        0,
        100,
      );
    }

    const bottomHalf = viewEl.querySelector(".view-bottom-half");
    const bottomPad = bottomHalf
      ? parseFloat(getComputedStyle(bottomHalf).paddingBottom || "0")
      : 0;

    const handlerPx = handler.getBoundingClientRect().height || 16;
    const usableHeight = Math.max(1, rect.height - bottomPad - handlerPx);

    return clamp(((ev.clientY - rect.top) / usableHeight) * 100, 0, 100);
  };

  const applyLive = (raw) => {
    lastRaw = clamp(raw, 0, 100);

    const forced = getForcedTargetForViewport();
    if (forced != null) {
      lastRaw = forced;
    }

    viewEl.classList.toggle(
      "split-force-middle",
      forced !== null && forced !== 0 && forced !== 100,
    );

    viewEl.classList.add("split-live");
    viewEl.classList.remove(
      "split-top-hidden",
      "split-middle",
      "split-bottom-hidden",
    );

    if (isMobilePortrait() && lastRaw >= 96.5) {
      viewEl.dataset.splitTarget = "bottom";
    } else {
      viewEl.dataset.splitTarget = "";
    }

    applyOverlayFlag(viewEl, null, { liveRaw: lastRaw });

    viewEl.style.setProperty("--split", `${lastRaw}%`);
    setCollapseFx(viewEl, lastRaw);

    handler.setAttribute("aria-valuenow", String(Math.round(lastRaw)));
  };

  const snapFromCurrent = () => {
    const anchors = getAnchors();
    const tuning = getInertiaTuning(activePointerType);

    if (anchors.length === 1) {
      applySnapToAll(anchors[0], { animate: true, duration: 220 });
      return;
    }

    const inertiaShift = clamp(
      velocity * tuning.gain,
      -tuning.maxShift,
      tuning.maxShift,
    );

    const projected = clamp(lastRaw + inertiaShift, 0, 100);

    let target;
    if (Math.abs(projected - 0) <= SNAP_THRESHOLD) target = 0;
    else if (Math.abs(projected - getMiddleAnchor()) <= SNAP_THRESHOLD) {
      target = getMiddleAnchor();
    } else if (Math.abs(projected - 100) <= SNAP_THRESHOLD) target = 100;
    else target = nearestAnchor(projected, anchors);

    applySnapToAll(target, { animate: true, duration: tuning.duration });
  };

  const cycleState = () => {
    const forced = getForcedTargetForViewport();
    if (forced != null) {
      applySnapToAll(forced, { animate: true, duration: 220 });
      return;
    }

    const middle = getMiddleAnchor();
    const currentTarget = getTargetFromGlobalSnap();

    if (currentTarget === 0) {
      applySnapToAll(middle, { animate: true, duration: 240 });
      return;
    }
    if (currentTarget === middle) {
      applySnapToAll(100, { animate: true, duration: 240 });
      return;
    }
    applySnapToAll(0, { animate: true, duration: 240 });
  };

  handler.setAttribute("tabindex", "0");
  handler.setAttribute("aria-label", "Split view size");

  handler.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    dragging = true;
    activePointerType = e.pointerType || "touch";
    velocity = 0;
    lastTs = performance.now();

    lastRaw =
      parseFloat(viewEl.style.getPropertyValue("--split")) ||
      getTargetFromGlobalSnap();

    lastRawForVel = lastRaw;

    handler.classList.add("is-dragging");
    handler.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      if (!dragging) return;

      const raw = pointerToRaw(ev);
      const now = performance.now();
      const dt = Math.max(1, now - lastTs);
      const instV = (raw - lastRawForVel) / dt;

      const tune = getInertiaTuning(activePointerType);
      velocity = velocity * tune.keep + instV * tune.add;

      lastTs = now;
      lastRawForVel = raw;

      applyLive(raw);
    };

    const onUp = () => {
      if (!dragging) return;

      dragging = false;
      handler.classList.remove("is-dragging");
      snapFromCurrent();

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  handler.addEventListener("click", () => {
    if (dragging) return;

    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
      cycleState();
      return;
    }

    tapTimer = setTimeout(() => {
      tapTimer = null;
    }, 260);
  });

  handler.addEventListener("keydown", (e) => {
    const forced = getForcedTargetForViewport();
    if (forced != null) {
      e.preventDefault();
      applySnapToAll(forced, { animate: true, duration: 220 });
      return;
    }

    const middle = getMiddleAnchor();

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cycleState();
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      applySnapToAll(0, { animate: true, duration: 220 });
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      applySnapToAll(100, { animate: true, duration: 220 });
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      applySnapToAll(0, { animate: true, duration: 220 });
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      applySnapToAll(100, { animate: true, duration: 220 });
      return;
    }

    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      applySnapToAll(middle, { animate: true, duration: 220 });
    }
  });
}

export function initSplitResizer() {
  // Защита от повторной инициализации
  detachViewportListeners?.();
  detachViewportListeners = null;

  views = VIEW_IDS.map((id) => {
    const viewEl = document.getElementById(id);
    if (!viewEl) return null;

    return {
      viewEl,
      handler: viewEl.querySelector(".resizer_handler"),
      topHalf: viewEl.querySelector(".view-top-half"),
    };
  }).filter(Boolean);

  views.forEach(setupOneView);

  const initialTarget = getTargetFromGlobalSnap();
  applySnapToAll(initialTarget, { animate: false });

  function isUltraCompactViewport() {
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    return h < 320 || (w < 420 && h < 420);
  }

  const onViewportResize = () => {
    if (isUltraCompactViewport()) {
      globalSnap = "middle";
      applySnapToAll(getMiddleAnchor(), { animate: false });
      return;
    }

    const forced = getForcedTargetForViewport();
    if (forced != null) {
      globalSnap = forced === 100 ? "bottom" : "middle";
      applySnapToAll(forced, { animate: false });
      return;
    }

    applySnapToAll(getTargetFromGlobalSnap(), { animate: false });
  };

  window.addEventListener("resize", onViewportResize);
  window.addEventListener("orientationchange", onViewportResize);

  detachViewportListeners = () => {
    window.removeEventListener("resize", onViewportResize);
    window.removeEventListener("orientationchange", onViewportResize);
  };

  return detachViewportListeners;
}
