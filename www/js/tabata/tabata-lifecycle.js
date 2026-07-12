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

  let lastLifecycleHapticAt = 0;
  const LIFECYCLE_HAPTIC_MIN_INTERVAL_MS = 100;

  function vibrateLifecycle(pattern, level = "medium") {
    const now = performance.now();
    if (now - lastLifecycleHapticAt < LIFECYCLE_HAPTIC_MIN_INTERVAL_MS) return;
    lastLifecycleHapticAt = now;
    sm.vibrate(pattern, level);
  }

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

  tb.toggle = () => {
    vibrateLifecycle(40, "light");
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

    tb.phaseClosing = false;
    clearPhaseClose(tb);

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

    stopTimerContext();
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

    tb.phaseClosing = false;
    clearPhaseClose(tb);

    tb.phaseStamp += 1;
    tb.lastRenderedPhaseStamp = -1;

    startTimerContext();
    worker.postMessage({ command: "start" });

    tb.updatePhaseStyles();
    requestAnimationFrame(() => tb.tick());
  };

  tb.stop = ({ resetRing = true, silent = false } = {}) => {
    if (!silent) {
      vibrateLifecycle(30, "medium");
      sm.play("click");
    }

    store.clearActiveTimer();

    if (tb.els.runningWorkoutName) updateText(tb.els.runningWorkoutName, "");

    worker.postMessage({ command: "stop" });

    if (tb.rAF) cancelAnimationFrame(tb.rAF);
    tb.rAF = null;

    clearPhaseClose(tb);
    tb.phaseClosing = false;

    applyTabataEngineSnapshot(tb, tb.tabataEngine.stop());
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
    tb.els.timer.style.transform = "";

    if (resetRing) {
      tb.ringCtrl?.snap(tb.ringLength);
    }
  };
}
