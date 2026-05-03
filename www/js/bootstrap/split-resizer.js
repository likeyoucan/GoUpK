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

  if (target === 0) {
    viewEl.classList.add("split-top-hidden");
  } else if (target === 100) {
    viewEl.classList.add("split-bottom-hidden");
  } else {
    viewEl.classList.add("split-middle");
  }
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

  const animateToAnchor = (target) => {
    const token = ++snapToken;

    viewEl.classList.remove("split-live");
    viewEl.classList.add("split-animating");

    // На время анимации держим "middle", чтобы не было резкого пересчета layout.
    setFinalStateClass(viewEl, getMiddleAnchor());
    viewEl.style.setProperty("--split", `${target}%`);

    const onEnd = (e) => {
      if (token !== snapToken) return;
      if (e.target !== topHalf || e.propertyName !== "flex-basis") return;

      topHalf.removeEventListener("transitionend", onEnd);
      viewEl.classList.remove("split-animating");
      setFinalStateClass(viewEl, target);
    };

    topHalf.addEventListener("transitionend", onEnd);

    // fallback
    setTimeout(() => {
      if (token !== snapToken) return;
      topHalf.removeEventListener("transitionend", onEnd);
      viewEl.classList.remove("split-animating");
      setFinalStateClass(viewEl, target);
    }, 280);
  };

  const snapToAnchor = () => {
    const anchors = getAnchors();
    const middle = anchors[1];

    let target = lastRaw;
    if (Math.abs(lastRaw - 0) <= SNAP_THRESHOLD) target = 0;
    else if (Math.abs(lastRaw - middle) <= SNAP_THRESHOLD) target = middle;
    else if (Math.abs(lastRaw - 100) <= SNAP_THRESHOLD) target = 100;
    else target = nearestAnchor(lastRaw, anchors);

    animateToAnchor(target);
  };

  const cycleState = () => {
    const middle = getMiddleAnchor();

    if (viewEl.classList.contains("split-top-hidden")) {
      animateToAnchor(middle);
      return;
    }

    if (viewEl.classList.contains("split-middle")) {
      animateToAnchor(100);
      return;
    }

    animateToAnchor(0);
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
      applyLiveRaw(readRawPercent(ev));
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
      animateToAnchor(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      animateToAnchor(100);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      animateToAnchor(0);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      animateToAnchor(100);
      return;
    }

    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      animateToAnchor(middle);
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
