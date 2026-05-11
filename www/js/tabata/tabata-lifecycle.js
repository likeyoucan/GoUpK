// Файл: www/js/tabata/tabata-lifecycle.js

export function setupTabataLifecycle(tb, deps) {
  const {
    sm,
    store,
    requestWakeLock,
    releaseWakeLock,
    updateTitle,
    updateText,
    t,
    bgWorker,
  } = deps;

  const worker = bgWorker || {
    postMessage: () => {},
    addEventListener: () => {},
  };

  function startTimerContext() {
    requestWakeLock();
  }

  function stopTimerContext() {
    releaseWakeLock();
    updateTitle("");
  }

  tb.toggle = () => {
    sm.vibrate(40, "light");
    sm.play("click");
    sm.unlock();

    if (tb.status === "STOPPED") tb.start();
    else if (tb.paused) tb.resume();
    else tb.pause();
  };

  tb.start = () => {
    store.activate("tabata");

    const workout = tb.workouts.find((w) => w.id === tb.selectedId);
    if (workout && tb.els.runningWorkoutName) {
      updateText(tb.els.runningWorkoutName, workout.name);
    }

    tb.currentRound = 1;
    tb.status = "READY";
    tb.phaseDuration = 5000;
    tb.phaseEndTime = Date.now() + tb.phaseDuration;
    tb.paused = false;
    tb.remainingAtPause = 0;
    tb.lastBeepSec = 0;
    tb.lastRender = 0;
    tb.completionHandled = false;

    tb.phaseClosing = false;
    if (tb.phaseCloseTimer) {
      clearTimeout(tb.phaseCloseTimer);
      tb.phaseCloseTimer = null;
    }

    tb.phaseStamp += 1;
    tb.lastRenderedPhaseStamp = -1;

    tb.ringCtrl?.snap(tb.ringLength);

    tb.els.listSection.classList.add("hidden");
    tb.els.runningControls.classList.remove("hidden");
    tb.els.runningControls.classList.add("flex");

    updateText(tb.els.totalRoundsDisplay, tb.rounds);
    tb.els.status.classList.remove("hidden");
    tb.els.timer.classList.remove("is-go");

    startTimerContext();
    tb.updatePhaseStyles();

    worker.postMessage({ command: "start" });
    tb.tick();
  };

  tb.pause = () => {
    store.clearActiveTimer();
    tb.paused = true;

    worker.postMessage({ command: "stop" });

    if (tb.rAF) cancelAnimationFrame(tb.rAF);
    tb.rAF = null;

    tb.remainingAtPause = Math.max(0, tb.phaseEndTime - Date.now());
    updateText(tb.els.status, t("pause"));

    stopTimerContext();
  };

  tb.resume = () => {
    if (tb.status === "STOPPED") return;

    store.activate("tabata");
    tb.paused = false;
    tb.completionHandled = false;
    tb.phaseEndTime = Date.now() + Math.max(0, tb.remainingAtPause || 0);
    tb.lastBeepSec = 0;
    tb.lastRender = 0;

    tb.phaseClosing = false;
    if (tb.phaseCloseTimer) {
      clearTimeout(tb.phaseCloseTimer);
      tb.phaseCloseTimer = null;
    }

    tb.phaseStamp += 1;
    tb.lastRenderedPhaseStamp = -1;

    startTimerContext();
    worker.postMessage({ command: "start" });

    tb.tick();
    tb.updatePhaseStyles();
  };

  tb.stop = ({ resetRing = true, silent = false } = {}) => {
    if (!silent) {
      sm.vibrate(30, "medium");
      sm.play("click");
    }

    store.clearActiveTimer();

    if (tb.els.runningWorkoutName) updateText(tb.els.runningWorkoutName, "");

    worker.postMessage({ command: "stop" });

    if (tb.rAF) cancelAnimationFrame(tb.rAF);
    tb.rAF = null;

    if (tb.phaseCloseTimer) {
      clearTimeout(tb.phaseCloseTimer);
      tb.phaseCloseTimer = null;
    }
    tb.phaseClosing = false;

    tb.status = "STOPPED";
    tb.paused = false;
    tb.remainingAtPause = 0;
    tb.completionHandled = true;

    stopTimerContext();

    tb.els.listSection.classList.remove("hidden");
    tb.els.runningControls.classList.remove("flex");
    tb.els.runningControls.classList.add("hidden");
    tb.els.status.classList.add("hidden");

    updateText(tb.els.timer, "GO");
    tb.els.timer.classList.add("is-go");

    if (resetRing) {
      tb.ringCtrl?.snap(tb.ringLength);
    }
  };
}
