// Файл: www/js/tabata/tabata-lifecycle.js

import { clearPhaseClose } from "../core/phase-close.js?v=VERSION";
import { applyTabataEngineSnapshot } from "../core/engine-adapters.js?v=VERSION";

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

  function configureEnginePlan() {
    tb.tabataEngine.configure({
      workMs: tb.work,
      restMs: tb.rest,
      rounds: tb.rounds,
      readyMs: 5000,
    });
  }

  function startTimerContext() {
    requestWakeLock();
  }

  function stopTimerContext() {
    releaseWakeLock();
    updateTitle("");
  }

  function resetPhaseLocks() {
    tb.phaseClosing = false;
    tb._phaseTransitionLock = false;
    tb._phaseCloseToken = 0;
    clearPhaseClose(tb);
  }

  // Single source of truth for list/running panels visibility.
  function syncPanels() {
    const isActiveSession = tb.status !== "STOPPED";

    tb.els.listSection?.classList.toggle("hidden", isActiveSession);

    tb.els.runningControls?.classList.toggle("hidden", !isActiveSession);
    tb.els.runningControls?.classList.toggle("flex", isActiveSession);
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

    configureEnginePlan();
    applyTabataEngineSnapshot(tb, tb.tabataEngine.startReady());

    tb.paused = false;
    tb.remainingAtPause = 0;
    tb.lastBeepSec = 0;
    tb.lastRender = 0;
    tb.completionHandled = false;

    resetPhaseLocks();

    tb.phaseStamp += 1;
    tb.lastRenderedPhaseStamp = -1;

    tb.ringCtrl?.snap(tb.ringLength);

    syncPanels();

    updateText(tb.els.totalRoundsDisplay, tb.rounds);
    tb.els.status.classList.remove("hidden");
    tb.els.timer.classList.remove("is-go");

    startTimerContext();
    tb.updatePhaseStyles();

    worker.postMessage({ command: "start" });
    requestAnimationFrame(() => tb.tick());
  };

  tb.pause = () => {
    store.clearActiveTimer();
    tb.paused = true;

    worker.postMessage({ command: "stop" });

    if (tb.rAF) cancelAnimationFrame(tb.rAF);
    tb.rAF = null;

    tb.remainingAtPause = tb.tabataEngine.pause();
    updateText(tb.els.status, t("pause"));

    // Prevent stale delayed phase close while paused.
    resetPhaseLocks();

    stopTimerContext();
    syncPanels();
  };

  tb.resume = () => {
    if (tb.status === "STOPPED") return;

    store.activate("tabata");
    tb.paused = false;
    tb.completionHandled = false;

    applyTabataEngineSnapshot(
      tb,
      tb.tabataEngine.resume(Math.max(0, tb.remainingAtPause || 0)),
    );

    tb.lastBeepSec = 0;
    tb.lastRender = 0;

    resetPhaseLocks();

    tb.phaseStamp += 1;
    tb.lastRenderedPhaseStamp = -1;

    startTimerContext();
    worker.postMessage({ command: "start" });

    tb.updatePhaseStyles();
    syncPanels();
    requestAnimationFrame(() => tb.tick());
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

    resetPhaseLocks();

    applyTabataEngineSnapshot(tb, tb.tabataEngine.stop());
    tb.paused = false;
    tb.remainingAtPause = 0;
    tb.completionHandled = true;

    stopTimerContext();

    syncPanels();

    tb.els.status.classList.add("hidden");

    updateText(tb.els.timer, "GO");
    tb.els.timer.classList.add("is-go");
    tb.els.timer.style.transform = "";

    if (resetRing) {
      tb.ringCtrl?.snap(tb.ringLength);
    }
  };
}
