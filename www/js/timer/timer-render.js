// Файл: www/js/timer/timer-render.js

export function setupTimerRender(tm, { updateText, updateTitle }) {
  function getAdjustmentAmount(remainingSeconds) {
    if (remainingSeconds > 3600) return 900;
    if (remainingSeconds > 1800) return 300;
    if (remainingSeconds > 900) return 60;
    if (remainingSeconds > 300) return 30;
    if (remainingSeconds > 60) return 15;
    return 5;
  }

  function formatAdjustmentText(seconds) {
    if (seconds < 60) return `${seconds}s`;
    return `${seconds / 60}m`;
  }

  tm.updateUIState = () => {
    if (!tm.els.form) return;

    const showResetWrap = tm.isPaused;
    const showRestartWrap = tm.isPaused || tm.isFinished;

    tm.els.resetBtnWrap?.classList.toggle("hidden", !showResetWrap);
    tm.els.resetBtnWrap?.classList.toggle("flex", showResetWrap);

    tm.els.restartBtnWrap?.classList.toggle("hidden", !showRestartWrap);
    tm.els.restartBtnWrap?.classList.toggle("flex", showRestartWrap);

    if (tm.isRunning) {
      tm.els.form.classList.add("hidden");
      tm.els.status?.classList.add("hidden");
      tm.els.display?.classList.remove("is-go");
      tm.els.adjustControls?.classList.remove("hidden");
      tm.els.adjustControls?.classList.add("flex");
      return;
    }

    if (tm.isPaused) {
      tm.els.form.classList.add("hidden");
      tm.els.status?.classList.remove("hidden");
      updateText(tm.els.status, tm.t("pause"));
      tm.els.adjustControls?.classList.add("hidden");
      tm.els.adjustControls?.classList.remove("flex");
      return;
    }

    if (tm.isFinished) {
      tm.els.form.classList.add("hidden");
      tm.els.status?.classList.remove("hidden");
      updateText(tm.els.status, tm.t("timer_finished"));
      tm.els.display?.classList.remove("is-go");
      tm.els.adjustControls?.classList.add("hidden");
      tm.els.adjustControls?.classList.remove("flex");
      return;
    }

    tm.els.form.classList.remove("hidden");
    tm.els.status?.classList.add("hidden");
    tm.els.display?.classList.add("is-go");
    updateText(tm.els.display, "GO");
    tm.els.adjustControls?.classList.add("hidden");
    tm.els.adjustControls?.classList.remove("flex");
  };

  tm.updateAdjustButtons = () => {
    if (!tm.isRunning) return;

    const remainingSeconds = Math.ceil(tm.timeRemainingMs / 1000);
    const newAdjustmentSec = getAdjustmentAmount(remainingSeconds);

    if (newAdjustmentSec === tm.currentAdjustmentSec) return;

    tm.currentAdjustmentSec = newAdjustmentSec;
    const text = formatAdjustmentText(tm.currentAdjustmentSec);
    updateText(tm.els.plusValueSpan, `+ ${text}`);
    updateText(tm.els.minusValueSpan, `- ${text}`);
  };

  tm.updateDisplay = (rem) => {
    const hInput = parseInt(tm.els.h?.value, 10) || 0;
    const forceHours = hInput > 0 || tm.totalDuration >= 3600000;

    const timeStr = tm.formatTime(rem, { forceHours });
    updateText(tm.els.display, timeStr);
    updateTitle(timeStr);

    const appEl = tm.$("app");
    if (
      tm.els.ring &&
      tm.totalDuration > 0 &&
      !appEl?.classList.contains("is-view-transitioning")
    ) {
      const elapsed = tm.totalDuration - rem;
      const progress = Math.max(0, Math.min(1, elapsed / tm.totalDuration));
      tm.els.ring.style.strokeDashoffset = tm.ringLength * (1 - progress);
    }
  };
}
