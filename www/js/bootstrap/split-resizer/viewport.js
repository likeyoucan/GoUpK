// Файл: www/js/bootstrap/split-resizer/viewport.js

import { VIEWPORT_POLICY } from "./constants.js?v=VERSION";

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function isRowLayout(viewEl) {
  return getComputedStyle(viewEl).flexDirection.startsWith("row");
}

export function getViewportRatio() {
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  if (!w || !h) return 1;
  return w / h;
}

export function isNearSquareLandscape() {
  const w = window.innerWidth || 0;
  const ratio = getViewportRatio();
  return ratio > 1 && ratio <= 1.2 && w < 900;
}

export function getViewportRawMax() {
  return isNearSquareLandscape() ? 92 : 100;
}

export function getMiddleAnchor() {
  const ratio = getViewportRatio();
  if (ratio >= 1.15) return 50;
  if (ratio >= 0.9 && ratio <= 1.1) return 55;
  return 60;
}

export function getForcedTargetForViewport() {
  const h = window.innerHeight || 0;
  if (h <= VIEWPORT_POLICY.emergencyHeightMax) {
    return getMiddleAnchor();
  }
  return null;
}

export function normalizeTargetForGeometry(target) {
  if (isNearSquareLandscape() && target === 100) {
    return getMiddleAnchor();
  }
  return target;
}

export function normalizeTargetForViewport(target) {
  const forced = getForcedTargetForViewport();
  const base = forced == null ? target : forced;
  return normalizeTargetForGeometry(base);
}

export function targetToName(target, middle) {
  if (target === 0) return "top";
  if (target === 100) return "bottom";
  if (target === middle) return "middle";
  return "middle";
}

export function nameToTarget(name, middle) {
  if (name === "top") return 0;
  if (name === "bottom") return 100;
  return middle;
}

export function nearestAnchor(value, anchors) {
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

export function getInertiaTuning(pointerType) {
  if (pointerType === "mouse") {
    return { gain: 55, maxShift: 4, keep: 0.9, add: 0.1, duration: 220 };
  }
  if (pointerType === "pen") {
    return { gain: 90, maxShift: 7, keep: 0.82, add: 0.18, duration: 240 };
  }
  return { gain: 130, maxShift: 9, keep: 0.76, add: 0.24, duration: 280 };
}