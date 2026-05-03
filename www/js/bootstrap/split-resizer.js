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

function getEdgeVisualRange(viewEl) {
  const row = isRowLayout(viewEl);
  // Держим handler всегда видимым у краев
  return row ? { min: 2.5, max: 97.5 } : { min: 3.5, max: 96.5 };
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

function setupHandler(viewEl) {
  const handler = viewEl.querySelector(".resizer_handler");
  if (!handler) return;

  const SNAP_THRESHOLD = 10;
  const MAX_INERTIA_SHIFT = 8; // максимум добавки от скорости в процентах

  let dragging = false;
  let lastRaw = getMiddleAnchor();
  let lastTs = 0;
  let lastRawForVel = lastRaw;
  let velocity = 0; // %/ms
  let tapTimer = null;

  function getAnchors() {
    return [0, getMiddleAnchor(), 100];
  }

  function toRawFromPointer(ev) {
    const rect = viewEl.getBoundingClientRect();
    const row = isRowLayout(viewEl);

    if (row) {
      return clamp(
        ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100,
        0,
        100,
      );
    }
    return clamp(
      ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 100,
      0,
      100,
    );
  }

  function applyLive(raw) {
    const { min, max } = getEdgeVisualRange(viewEl);
    lastRaw = clamp(raw, min, max);

    viewEl.classList.add("split-live");
    viewEl.classList.remove(
      "split-top-hidden",
      "split-middle",
      "split-bottom-hidden",
    );
    viewEl.style.setProperty("--split", `${lastRaw}%`);
  }

  function animateTo(target) {
    const middle = getMiddleAnchor();
    const { min, max } = getEdgeVisualRange(viewEl);
    const visualTarget = target === 0 ? min : target === 100 ? max : middle;

    viewEl.classList.remove("split-live");
    viewEl.classList.add("split-animating");
    setStateClass(viewEl, middle); // нейтраль во время анимации
    viewEl.style.setProperty("--split", `${visualTarget}%`);

    const topHalf = viewEl.querySelector(".view-top-half");
    const end = () => {
      viewEl.classList.remove("split-animating");
      setStateClass(viewEl, target);
    };

    let done = false;
    const onEnd = (e) => {
      if (done) return;
      if (e.target !== topHalf || e.propertyName !== "flex-basis") return;
      done = true;
      topHalf?.removeEventListener("transitionend", onEnd);
      end();
    };

    topHalf?.addEventListener("transitionend", onEnd);
    setTimeout(() => {
      if (done) return;
      done = true;
      topHalf?.removeEventListener("transitionend", onEnd);
      end();
    }, 320);
  }

  function snapToNearestWithInertia() {
    const anchors = getAnchors();
    const middle = anchors[1];

    // Мягкая инерция: ограничиваем смещение, чтобы не "перелетать" к другому краю
    const inertiaShift = clamp(
      velocity * 110,
      -MAX_INERTIA_SHIFT,
      MAX_INERTIA_SHIFT,
    );
    const projected = clamp(lastRaw + inertiaShift, 0, 100);

    let target;
    if (Math.abs(projected - 0) <= SNAP_THRESHOLD) target = 0;
    else if (Math.abs(projected - middle) <= SNAP_THRESHOLD) target = middle;
    else if (Math.abs(projected - 100) <= SNAP_THRESHOLD) target = 100;
    else target = nearestAnchor(projected, anchors);

    animateTo(target);
  }

  function cycleState() {
    const middle = getMiddleAnchor();
    if (viewEl.classList.contains("split-top-hidden")) return animateTo(middle);
    if (viewEl.classList.contains("split-middle")) return animateTo(100);
    return animateTo(0);
  }

  handler.setAttribute("tabindex", "0");
  handler.setAttribute("role", "button");
  handler.setAttribute("aria-label", "Resize panels");

  handler.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    dragging = true;
    velocity = 0;
    lastTs = performance.now();
    lastRawForVel = lastRaw;

    handler.classList.add("is-dragging");
    handler.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      if (!dragging) return;

      const raw = toRawFromPointer(ev);
      const now = performance.now();
      const dt = Math.max(1, now - lastTs);
      const instV = (raw - lastRawForVel) / dt;

      velocity = velocity * 0.78 + instV * 0.22;
      lastTs = now;
      lastRawForVel = raw;

      applyLive(raw);
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      handler.classList.remove("is-dragging");
      snapToNearestWithInertia();

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
    }, 250);
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
      animateTo(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      animateTo(100);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      animateTo(0);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      animateTo(100);
      return;
    }

    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      animateTo(middle);
    }
  });

  const middle = getMiddleAnchor();
  viewEl.style.setProperty("--split", `${middle}%`);
  setStateClass(viewEl, middle);
}

export function initSplitResizer() {
  ["view-stopwatch", "view-timer", "view-tabata"]
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .forEach(setupHandler);

  window.addEventListener("resize", () => {
    const middle = getMiddleAnchor();

    ["view-stopwatch", "view-timer", "view-tabata"]
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .forEach((viewEl) => {
        if (viewEl.classList.contains("split-middle")) {
          viewEl.style.setProperty("--split", `${middle}%`);
        }
      });
  });
}
