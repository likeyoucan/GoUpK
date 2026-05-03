// Файл: www/js/timer/timer-render.js

tm.updateUIState = () => {
  if (!tm.els.form) return;

  const showActionWrap = tm.isPaused || tm.isFinished;

  tm.els.resetBtnWrap?.classList.toggle("hidden", !showActionWrap);
  tm.els.resetBtnWrap?.classList.toggle("flex", showActionWrap);

  tm.els.resetBtn?.classList.toggle("hidden", !showActionWrap);
  tm.els.restartBtn?.classList.toggle("hidden", !showActionWrap);

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
