// Файл: www/js/bootstrap/stopwatch-gestures.js

export function bindStopwatchDoubleTapLap({ $, sw }) {
  let lastBgTap = 0;

  const viewEl = $("view-stopwatch");
  if (!viewEl) return () => {};

  const onTouchStart = (e) => {
    if (e.target.closest("button, .scroll-lock, .selectable-data")) return;

    const now = Date.now();
    if (now - lastBgTap < 300 && sw.isRunning) {
      e.preventDefault();
      sw.recordLapOrReset();
    }
    lastBgTap = now;
  };

  viewEl.addEventListener("touchstart", onTouchStart, { passive: false });

  return () => {
    viewEl.removeEventListener("touchstart", onTouchStart);
  };
}
