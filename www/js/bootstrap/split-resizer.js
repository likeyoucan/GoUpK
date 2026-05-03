function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getIsRowLayout(viewEl) {
  return getComputedStyle(viewEl).flexDirection.startsWith("row");
}

export function initSplitResizer() {
  const views = ["view-stopwatch", "view-timer", "view-tabata"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const SNAP_MIN = 6;
  const SNAP_MAX = 94;

  views.forEach((viewEl) => {
    const top = viewEl.querySelector(".view-top-half");
    const bottom = viewEl.querySelector(".view-bottom-half");
    const handler = viewEl.querySelector(".resizer_handler");
    const mid = bottom?.querySelector(".mid_content");

    if (!top || !bottom || !handler || !mid) return;

    const applySplit = (percent) => {
      const p = clamp(percent, 0, 100);
      const topCollapsed = p <= SNAP_MIN;
      const bottomCollapsed = p >= SNAP_MAX;

      viewEl.style.setProperty("--split", `${p}%`);
      handler.classList.toggle("is-dragging", false);

      if (topCollapsed) {
        top.style.flexBasis = "0%";
        top.style.pointerEvents = "none";
        bottom.style.flex = "1 1 auto";
        mid.style.display = "flex";
        return;
      }

      if (bottomCollapsed) {
        top.style.flexBasis = "100%";
        top.style.pointerEvents = "";
        bottom.style.flex = "0 0 var(--handler-size)";
        mid.style.display = "none";
        return;
      }

      top.style.flexBasis = `${p}%`;
      top.style.pointerEvents = "";
      bottom.style.flex = "1 1 auto";
      mid.style.display = "flex";
    };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();

      const isRow = getIsRowLayout(viewEl);
      handler.classList.add("is-dragging");
      handler.setPointerCapture?.(e.pointerId);

      const onMove = (ev) => {
        const rect = viewEl.getBoundingClientRect();
        const raw = isRow
          ? ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100
          : ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 100;
        applySplit(raw);
      };

      const onUp = () => {
        handler.classList.remove("is-dragging");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };

    handler.addEventListener("pointerdown", onPointerDown);
  });
}