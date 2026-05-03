// Файл: www/js/bootstrap/split-resizer.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function isRowLayout(viewEl) {
  return getComputedStyle(viewEl).flexDirection.startsWith("row");
}

function getMiddleAnchor(viewEl) {
  const isPhone = window.matchMedia("(max-width: 767px)").matches;
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;

  // На телефоне в портрете оставляем 60%, в остальных случаях 50%.
  if (isPhone && isPortrait) return 60;
  return 50;
}

function nearestAnchor(value, anchors) {
  let nearest = anchors[0];
  let minDist = Math.abs(value - nearest);

  for (let i = 1; i < anchors.length; i += 1) {
    const dist = Math.abs(value - anchors[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = anchors[i];
    }
  }

  return nearest;
}

function applyState(viewEl, value, middle) {
  const top = viewEl.querySelector(".view-top-half");
  const bottom = viewEl.querySelector(".view-bottom-half");
  const midContent = bottom?.querySelector(".mid_content");

  if (!top || !bottom || !midContent) return;

  viewEl.classList.remove(
    "split-top-hidden",
    "split-middle",
    "split-bottom-hidden",
  );

  if (value === 0) {
    viewEl.classList.add("split-top-hidden");
    viewEl.style.setProperty("--split", "0%");
    return;
  }

  if (value === 100) {
    viewEl.classList.add("split-bottom-hidden");
    viewEl.style.setProperty("--split", "100%");
    return;
  }

  viewEl.classList.add("split-middle");
  viewEl.style.setProperty("--split", `${middle}%`);
}

function setupHandler(viewEl) {
  const handler = viewEl.querySelector(".resizer_handler");
  if (!handler) return;

  const SNAP_THRESHOLD = 12;
  let dragging = false;
  let lastRaw = getMiddleAnchor(viewEl);
  let lastPointerId = null;
  let tapTimer = null;

  const getAnchors = () => {
    const middle = getMiddleAnchor(viewEl);
    return { anchors: [0, middle, 100], middle };
  };

  const getRawPercent = (ev) => {
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
    viewEl.classList.remove(
      "split-top-hidden",
      "split-middle",
      "split-bottom-hidden",
    );
    viewEl.style.setProperty("--split", `${lastRaw}%`);
  };

  const snapCurrent = () => {
    const { anchors, middle } = getAnchors();

    let target = lastRaw;
    if (Math.abs(lastRaw - 0) <= SNAP_THRESHOLD) target = 0;
    else if (Math.abs(lastRaw - middle) <= SNAP_THRESHOLD) target = middle;
    else if (Math.abs(lastRaw - 100) <= SNAP_THRESHOLD) target = 100;
    else target = nearestAnchor(lastRaw, anchors);

    applyState(viewEl, target, middle);
  };

  const cycleState = () => {
    const { middle } = getAnchors();

    if (viewEl.classList.contains("split-top-hidden")) {
      applyState(viewEl, middle, middle);
      return;
    }

    if (viewEl.classList.contains("split-middle")) {
      applyState(viewEl, 100, middle);
      return;
    }

    applyState(viewEl, 0, middle);
  };

  handler.setAttribute("tabindex", "0");
  handler.setAttribute("role", "slider");
  handler.setAttribute("aria-label", "Resize panels");

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    dragging = true;
    lastPointerId = e.pointerId ?? null;
    handler.classList.add("is-dragging");
    if (lastPointerId !== null) handler.setPointerCapture?.(lastPointerId);

    const onMove = (ev) => {
      if (!dragging) return;
      applyRaw(getRawPercent(ev));
    };

    const onUp = () => {
      if (!dragging) return;

      dragging = false;
      handler.classList.remove("is-dragging");
      snapCurrent();

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Двойной тап: быстрый UX-переключатель 0 -> middle -> 100 -> 0 ...
  const onClick = () => {
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
  };

  const onKeyDown = (e) => {
    const { middle } = getAnchors();

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cycleState();
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      applyState(viewEl, 0, middle);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      applyState(viewEl, 100, middle);
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      applyState(viewEl, 0, middle);
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      applyState(viewEl, 100, middle);
    }
  };

  handler.addEventListener("pointerdown", onPointerDown);
  handler.addEventListener("click", onClick);
  handler.addEventListener("keydown", onKeyDown);

  const { middle } = getAnchors();
  applyState(viewEl, middle, middle);
}

export function initSplitResizer() {
  ["view-stopwatch", "view-timer", "view-tabata"]
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .forEach((viewEl) => setupHandler(viewEl));

  // При смене ориентации/размера переводим middle в корректный 50/60.
  window.addEventListener("resize", () => {
    ["view-stopwatch", "view-timer", "view-tabata"]
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .forEach((viewEl) => {
        const middle = getMiddleAnchor(viewEl);
        if (viewEl.classList.contains("split-middle")) {
          viewEl.style.setProperty("--split", `${middle}%`);
        }
      });
  });
}
