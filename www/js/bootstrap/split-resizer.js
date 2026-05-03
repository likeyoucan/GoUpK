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

function applyState(viewEl, targetValue) {
  const middle = getMiddleAnchor();
  const snapped = targetValue === 0 ? 0 : targetValue === 100 ? 100 : middle;

  // Небольшая защита от "рывка": сначала ставим split, потом класс в следующий кадр
  viewEl.style.setProperty("--split", `${snapped}%`);
  viewEl.classList.add("split-snapping");

  requestAnimationFrame(() => {
    viewEl.classList.remove(
      "split-top-hidden",
      "split-middle",
      "split-bottom-hidden",
    );

    if (snapped === 0) {
      viewEl.classList.add("split-top-hidden");
    } else if (snapped === 100) {
      viewEl.classList.add("split-bottom-hidden");
    } else {
      viewEl.classList.add("split-middle");
    }

    setTimeout(() => viewEl.classList.remove("split-snapping"), 230);
  });
}

function setupHandler(viewEl) {
  const handler = viewEl.querySelector(".resizer_handler");
  if (!handler) return;

  const SNAP_THRESHOLD = 12;
  let dragging = false;
  let lastRaw = getMiddleAnchor();
  let singleTapTimer = null;

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

  const applyRaw = (raw) => {
    lastRaw = clamp(raw, 0, 100);

    // В drag-состоянии без резкого переключения display/flex
    viewEl.classList.remove(
      "split-top-hidden",
      "split-middle",
      "split-bottom-hidden",
    );
    viewEl.classList.add("split-live");
    viewEl.style.setProperty("--split", `${lastRaw}%`);
  };

  const snapToAnchor = () => {
    const anchors = getAnchors();
    const middle = anchors[1];

    let target = lastRaw;
    if (Math.abs(lastRaw - 0) <= SNAP_THRESHOLD) target = 0;
    else if (Math.abs(lastRaw - middle) <= SNAP_THRESHOLD) target = middle;
    else if (Math.abs(lastRaw - 100) <= SNAP_THRESHOLD) target = 100;
    else target = nearestAnchor(lastRaw, anchors);

    viewEl.classList.remove("split-live");
    applyState(viewEl, target);
  };

  const cycleState = () => {
    const middle = getMiddleAnchor();

    if (viewEl.classList.contains("split-top-hidden")) {
      applyState(viewEl, middle);
      return;
    }

    if (viewEl.classList.contains("split-middle")) {
      applyState(viewEl, 100);
      return;
    }

    applyState(viewEl, 0);
  };

  handler.setAttribute("tabindex", "0");
  handler.setAttribute("role", "button");
  handler.setAttribute("aria-label", "Resize panels");

  handler.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    dragging = true;
    handler.classList.add("is-dragging");
    handler.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      if (!dragging) return;
      applyRaw(readRawPercent(ev));
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

  // Двойной тап: цикл 0 -> middle -> 100 -> 0
  handler.addEventListener("click", () => {
    if (dragging) return;

    if (singleTapTimer) {
      clearTimeout(singleTapTimer);
      singleTapTimer = null;
      cycleState();
      return;
    }

    singleTapTimer = setTimeout(() => {
      singleTapTimer = null;
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
      applyState(viewEl, 0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      applyState(viewEl, 100);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      applyState(viewEl, 0);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      applyState(viewEl, 100);
      return;
    }

    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      applyState(viewEl, middle);
    }
  });

  applyState(viewEl, getMiddleAnchor());
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
