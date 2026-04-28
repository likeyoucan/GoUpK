// Файл: www/js/bootstrap/stopwatch-gestures.js

export function bindStopwatchDoubleTapLap({ $, sw, navigation }) {
  let lastBgTap = 0;

  const viewEl = $("view-stopwatch");
  if (!viewEl) return () => {};

  const onTouchStart = (e) => {
    if (navigation?.panel?.isDragging) return;
    if (e.target.closest(".panel-handle")) return;
    if (
      e.target.closest(
        "button, .scroll-lock, .selectable-data, input, textarea",
      )
    )
      return;

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
