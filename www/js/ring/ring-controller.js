// Файл: www/js/ring/ring-controller.js

export function createRingController({
  ringEl,
  initialOffset = 0,
  alpha = 0.22,
}) {
  let visual = Number.isFinite(initialOffset) ? initialOffset : 0;
  let target = visual;
  let active = false;
  let rafId = 0;

  const EPS = 0.2;

  const tick = () => {
    if (!active || !ringEl) {
      rafId = 0;
      return;
    }

    visual += (target - visual) * alpha;

    if (Math.abs(target - visual) < EPS) {
      visual = target;
      ringEl.style.strokeDashoffset = String(visual);
      rafId = 0;
      return;
    }

    ringEl.style.strokeDashoffset = String(visual);
    rafId = requestAnimationFrame(tick);
  };

  const ensureTick = () => {
    if (!active || !ringEl || rafId) return;
    rafId = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (active) return;
      active = true;
      ensureTick();
    },

    stop() {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },

    setTarget(offset) {
      if (!Number.isFinite(offset)) return;
      target = offset;
      if (Math.abs(target - visual) < EPS) {
        visual = target;
        if (ringEl) ringEl.style.strokeDashoffset = String(visual);
        return;
      }
      ensureTick();
    },

    snap(offset) {
      if (!Number.isFinite(offset)) return;
      target = offset;
      visual = offset;
      if (ringEl) ringEl.style.strokeDashoffset = String(offset);
    },

    setAlpha(nextAlpha) {
      if (!Number.isFinite(nextAlpha)) return;
      alpha = nextAlpha;
    },

    getVisual() {
      return visual;
    },
  };
}
