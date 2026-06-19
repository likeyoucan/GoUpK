// Файл: www/js/bootstrap/split-resizer/apply.js

import {
  clamp,
  getMiddleAnchor,
  getForcedTargetForViewport,
  normalizeTargetForViewport,
  targetToName,
  nameToTarget,
  isRowLayout,
} from "./viewport.js?v=VERSION";

export function setStateClass(viewEl, target) {
  viewEl.classList.remove(
    "split-top-hidden",
    "split-middle",
    "split-bottom-hidden",
  );

  if (target === 0) viewEl.classList.add("split-top-hidden");
  else if (target === 100) viewEl.classList.add("split-bottom-hidden");
  else viewEl.classList.add("split-middle");
}

export function setCollapseFx(viewEl, raw) {
  const middle = getMiddleAnchor();
  const topLinear = clamp((middle - raw) / middle, 0, 1);
  const bottomLinear = clamp((raw - middle) / (100 - middle), 0, 1);

  const topK = Math.pow(topLinear, 1.15);
  const bottomK = Math.pow(bottomLinear, 1.15);

  viewEl.style.setProperty("--collapse-top-k", topK.toFixed(3));
  viewEl.style.setProperty("--collapse-bottom-k", bottomK.toFixed(3));
}

export function setHandlerA11y(handler, snapValue) {
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

export function getTargetFromGlobalSnap(ctx) {
  const middle = getMiddleAnchor();
  const target = nameToTarget(ctx.globalSnap, middle);
  return normalizeTargetForViewport(target);
}

export function applyOverlayFlag(ctx, viewEl, target, { liveRaw = null } = {}) {
  if (!ctx.behavior.overlayWhenBottomHidden) {
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

export function updateAllA11y(ctx) {
  const target = getTargetFromGlobalSnap(ctx);
  ctx.views.forEach((v) => {
    if (v.handler) setHandlerA11y(v.handler, target);
  });
}

export function applySnapToAll(
  ctx,
  target,
  { animate = true, duration = 240 } = {},
) {
  const forcedTarget = getForcedTargetForViewport();
  if (forcedTarget != null) target = forcedTarget;

  target = normalizeTargetForViewport(target);

  const middle = getMiddleAnchor();
  const forcedMiddle =
    forcedTarget !== null && forcedTarget !== 0 && forcedTarget !== 100;

  if (forcedMiddle) target = middle;

  const visualTarget = target === 0 ? 0.15 : target === 100 ? 99.85 : middle;
  const targetName = targetToName(target, middle);

  ctx.views.forEach(({ viewEl, topHalf }) => {
    if (!viewEl || !topHalf) return;

    viewEl.classList.toggle("split-force-middle", forcedMiddle);
    viewEl.dataset.splitTarget = targetName;
    applyOverlayFlag(ctx, viewEl, target);

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
      applyOverlayFlag(ctx, viewEl, target);
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

  ctx.globalSnap = targetName;
  updateAllA11y(ctx);
}
