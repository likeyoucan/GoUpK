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

function setFinalStateClass(viewEl, target) {
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
  const topHalf = viewEl.querySelector(".view-top-half");
  if (!handler || !topHalf) return;

  const SNAP_THRESHOLD = 12;
  let dragging = false;
  let lastRaw = getMiddleAnchor();
  let tapTimer = null;
  let snapToken = 0;

  // Инерция
  let lastMoveTs = 0;
  let lastMoveRaw = lastRaw;
  let velocity = 0; // % / ms

  const getAnchors = () => {
    const middle = getMiddleAnchor();
    return [0, middle, 100];
  };

  const readRawPercent = (ev) => {
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
  };

  const applyLiveRaw = (raw) => {
    lastRaw = clamp(raw, 0, 100);

    viewEl.classList.remove(
      "split-top-hidden",
      "split-middle",
      "split-bottom-hidden",
    );
    viewEl.classList.remove("split-animating");
    viewEl.classList.add("split-live");
    viewEl.style.setProperty("--split", `${lastRaw}%`);
  };

  const animateToAnchor = (target, v = 0) => {
    const token = ++snapToken;

    // Длительность зависит от скорости, чтобы чувствовалась "инертность"
    const speed = Math.abs(v);
    const duration = Math.round(clamp(240 + speed * 1200, 240, 430));
    viewEl.style.setProperty("--split-snap-duration", `${duration}ms`);

    viewEl.classList.remove("split-live");
    viewEl.classList.add("split-animating");

    // На время анимации держим neutral-state, чтобы не дергать layout.
    setFinalStateClass(viewEl, getMiddleAnchor());

    // Анти-рывок: не прыгаем в "жесткий 0/100" во время самой анимации
    const visualTarget = target === 0 ? 0.12 : target === 100 ? 99.88 : target;
    viewEl.style.setProperty("--split", `${visualTarget}%`);

    const onEnd = (e) => {
      if (token !== snapToken) return;
      if (e.target !== topHalf || e.propertyName !== "flex-basis") return;

      topHalf.removeEventListener("transitionend", onEnd);
      viewEl.classList.remove("split-animating");

      // Финальное состояние после анимации
      if (target === 0) viewEl.style.setProperty("--split", "0.12%");
      else if (target === 100) viewEl.style.setProperty("--split", "99.88%");
      else viewEl.style.setProperty("--split", `${target}%`);

      setFinalStateClass(viewEl, target);
    };

    topHalf.addEventListener("transitionend", onEnd);

    setTimeout(() => {
      if (token !== snapToken) return;
      topHalf.removeEventListener("transitionend", onEnd);
      viewEl.classList.remove("split-animating");

      if (target === 0) viewEl.style.setProperty("--split", "0.12%");
      else if (target === 100) viewEl.style.setProperty("--split", "99.88%");
      else viewEl.style.setProperty("--split", `${target}%`);

      setFinalStateClass(viewEl, target);
    }, duration + 70);
  };

  const snapToAnchor = () => {
    const anchors = getAnchors();
    const middle = anchors[1];

    // Инерционная проекция
    const projected = clamp(lastRaw + velocity * 170, 0, 100);

    let target = projected;
    if (Math.abs(projected - 0) <= SNAP_THRESHOLD) target = 0;
    else if (Math.abs(projected - middle) <= SNAP_THRESHOLD) target = middle;
    else if (Math.abs(projected - 100) <= SNAP_THRESHOLD) target = 100;
    else target = nearestAnchor(projected, anchors);

    animateToAnchor(target, velocity);
  };

  const cycleState = () => {
    const middle = getMiddleAnchor();

    if (viewEl.classList.contains("split-top-hidden")) {
      animateToAnchor(middle, 0.12);
      return;
    }
    if (viewEl.classList.contains("split-middle")) {
      animateToAnchor(100, 0.12);
      return;
    }
    animateToAnchor(0, 0.12);
  };

  handler.setAttribute("tabindex", "0");
  handler.setAttribute("role", "button");
  handler.setAttribute("aria-label", "Resize panels");

  handler.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    dragging = true;
    velocity = 0;
    lastMoveTs = performance.now();
    lastMoveRaw = lastRaw;

    handler.classList.add("is-dragging");
    handler.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      if (!dragging) return;

      const now = performance.now();
      const raw = readRawPercent(ev);
      const dt = Math.max(1, now - lastMoveTs);
      const instV = (raw - lastMoveRaw) / dt;

      // low-pass, чтобы скорость была плавной
      velocity = velocity * 0.72 + instV * 0.28;
      lastMoveTs = now;
      lastMoveRaw = raw;

      applyLiveRaw(raw);
    };

    const onUp = () => {
      if (!dragging) return;

      dragging = false;
      handler.classList.remove("is-dragging");
      snapToAnchor();

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
      animateToAnchor(0, 0.1);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      animateToAnchor(100, 0.1);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      animateToAnchor(0, 0.1);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      animateToAnchor(100, 0.1);
      return;
    }
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      animateToAnchor(middle, 0.1);
    }
  });

  const middle = getMiddleAnchor();
  viewEl.style.setProperty("--split", `${middle}%`);
  setFinalStateClass(viewEl, middle);
}

export function initSplitResizer() {
  ["view-stopwatch", "view-timer", "view-tabata"]
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .forEach((viewEl) => setupHandler(viewEl));

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
