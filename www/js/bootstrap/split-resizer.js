// Файл: www/js/bootstrap/split-resizer.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function isRowLayout(viewEl) {
  return getComputedStyle(viewEl).flexDirection.startsWith("row");
}

function getMiddleAnchor() {
  const isPhone = window.matchMedia("(max-width: 767px)").matches;
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  return isPhone && isPortrait ? 60 : 50;
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

function setupResizerForView(viewEl) {
  const handler = viewEl.querySelector(".resizer_handler");
  const topHalf = viewEl.querySelector(".view-top-half");
  if (!handler || !topHalf) return;

  const SNAP_THRESHOLD = 10;
  let dragging = false;
  let lastRaw = getMiddleAnchor();
  let activePointerType = "touch";

  let lastTs = 0;
  let lastRawForVel = lastRaw;
  let velocity = 0;
  let tapTimer = null;

  const setAriaSnap = (snapValue) => {
    const middle = getMiddleAnchor();
    const normalized =
      snapValue === middle ? middle : snapValue === 0 ? 0 : 100;

    handler.setAttribute("aria-valuemin", "0");
    handler.setAttribute("aria-valuemax", "100");
    handler.setAttribute("aria-valuenow", String(normalized));
    handler.setAttribute(
      "aria-valuetext",
      normalized === middle ? `middle ${middle}%` : `${normalized}%`,
    );
  };

  const setAriaLive = (rawValue) => {
    handler.setAttribute("aria-valuemin", "0");
    handler.setAttribute("aria-valuemax", "100");
    handler.setAttribute("aria-valuenow", String(Math.round(rawValue)));
  };

  const getAnchors = () => [0, getMiddleAnchor(), 100];

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

    const usableHeight = Math.max(1, rect.height - bottomPad);
    return clamp(((ev.clientY - rect.top) / usableHeight) * 100, 0, 100);
  };

  const getInertiaTuning = (pointerType) => {
    if (pointerType === "mouse") {
      return { gain: 55, maxShift: 4, keep: 0.9, add: 0.1, duration: 220 };
    }
    if (pointerType === "pen") {
      return { gain: 90, maxShift: 7, keep: 0.82, add: 0.18, duration: 240 };
    }
    return { gain: 130, maxShift: 9, keep: 0.76, add: 0.24, duration: 280 };
  };

  const applyLive = (raw) => {
    lastRaw = clamp(raw, 0, 100);

    viewEl.classList.add("split-live");
    viewEl.classList.remove(
      "split-top-hidden",
      "split-middle",
      "split-bottom-hidden",
    );
    viewEl.style.setProperty("--split", `${lastRaw}%`);
    setCollapseFx(viewEl, lastRaw);
    setAriaLive(lastRaw);
  };

  const animateTo = (target, durationMs) => {
    const middle = getMiddleAnchor();

    viewEl.style.setProperty("--split-snap-duration", `${durationMs}ms`);
    viewEl.classList.remove("split-live");
    viewEl.classList.add("split-animating");

    setStateClass(viewEl, middle);

    const visualTarget = target === 0 ? 0.15 : target === 100 ? 99.85 : middle;
    viewEl.style.setProperty("--split", `${visualTarget}%`);
    setCollapseFx(viewEl, visualTarget);

    let done = false;

    const finish = () => {
      if (done) return;
      done = true;

      viewEl.classList.remove("split-animating");
      setStateClass(viewEl, target);

      if (target === 0) setCollapseFx(viewEl, 0);
      else if (target === 100) setCollapseFx(viewEl, 100);
      else setCollapseFx(viewEl, middle);

      setAriaSnap(target);
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
    }, durationMs + 90);
  };

  const snapToNearest = () => {
    const anchors = getAnchors();
    const middle = anchors[1];
    const tuning = getInertiaTuning(activePointerType);

    const inertiaShift = clamp(
      velocity * tuning.gain,
      -tuning.maxShift,
      tuning.maxShift,
    );

    const projected = clamp(lastRaw + inertiaShift, 0, 100);

    let target;
    if (Math.abs(projected - 0) <= SNAP_THRESHOLD) target = 0;
    else if (Math.abs(projected - middle) <= SNAP_THRESHOLD) target = middle;
    else if (Math.abs(projected - 100) <= SNAP_THRESHOLD) target = 100;
    else target = nearestAnchor(projected, anchors);

    animateTo(target, tuning.duration);
  };

  const cycleState = () => {
    const middle = getMiddleAnchor();
    if (viewEl.classList.contains("split-top-hidden")) {
      animateTo(middle, 240);
      return;
    }
    if (viewEl.classList.contains("split-middle")) {
      animateTo(100, 240);
      return;
    }
    animateTo(0, 240);
  };

  handler.setAttribute("tabindex", "0");
  handler.setAttribute("role", "slider");
  handler.setAttribute("aria-label", "Split view size");

  handler.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    dragging = true;
    activePointerType = e.pointerType || "touch";
    velocity = 0;
    lastTs = performance.now();
    lastRawForVel = lastRaw;

    handler.classList.add("is-dragging");
    handler.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      if (!dragging) return;

      const raw = pointerToRaw(ev);
      const now = performance.now();
      const dt = Math.max(1, now - lastTs);
      const instV = (raw - lastRawForVel) / dt;

      const t = getInertiaTuning(activePointerType);
      velocity = velocity * t.keep + instV * t.add;

      lastTs = now;
      lastRawForVel = raw;

      applyLive(raw);
    };

    const onUp = () => {
      if (!dragging) return;

      dragging = false;
      handler.classList.remove("is-dragging");
      snapToNearest();

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
    const middle = getMiddleAnchor();

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cycleState();
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      animateTo(0, 220);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      animateTo(100, 220);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      animateTo(0, 220);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      animateTo(100, 220);
      return;
    }

    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      animateTo(middle, 220);
    }
  });

  const middle = getMiddleAnchor();
  viewEl.style.setProperty("--split", `${middle}%`);
  viewEl.style.setProperty("--collapse-top-k", "0");
  viewEl.style.setProperty("--collapse-bottom-k", "0");
  setStateClass(viewEl, middle);
  setAriaSnap(middle);
}

export function initSplitResizer() {
  ["view-stopwatch", "view-timer", "view-tabata"]
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .forEach((viewEl) => setupResizerForView(viewEl));

  window.addEventListener("resize", () => {
    const middle = getMiddleAnchor();

    ["view-stopwatch", "view-timer", "view-tabata"]
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .forEach((viewEl) => {
        if (viewEl.classList.contains("split-middle")) {
          viewEl.style.setProperty("--split", `${middle}%`);
          viewEl.style.setProperty("--collapse-top-k", "0");
          viewEl.style.setProperty("--collapse-bottom-k", "0");
          const handler = viewEl.querySelector(".resizer_handler");
          handler?.setAttribute("aria-valuenow", String(middle));
          handler?.setAttribute("aria-valuetext", `middle ${middle}%`);
        }
      });
  });
}
