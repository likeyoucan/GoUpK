// Файл: www/js/ring/ring-controller.js

export function createRingController({
  ringEl,
  initialOffset = 0,
  alpha = 0.22,
}) {
  let visual = Number.isFinite(initialOffset) ? initialOffset : 0;
  let target = visual;
  let running = false;
  let rafId = 0;

  const tick = () => {
    if (!running || !ringEl) return;

    visual += (target - visual) * alpha;

    if (Math.abs(target - visual) < 0.2) {
      visual = target;
    }

    ringEl.style.strokeDashoffset = String(visual);
    rafId = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    },

    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },

    setTarget(offset) {
      if (!Number.isFinite(offset)) return;
      target = offset;
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
