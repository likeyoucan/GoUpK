// Файл: www/js/timer/timer-core.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";

export function setupTimerCore(tm, { showToast, updateText }) {
  tm.getRemainingTime = () => {
    if (!tm.isRunning && !tm.isPaused && !tm.isFinished) return 0;
    return tm.timeRemainingMs;
  };

  tm.toggle = () => {
    tm.sm.vibrate(40, "light");
    tm.sm.play("click");
    tm.sm.unlock();

    if (tm.isRunning) {
      tm.store.clearActiveTimer();
      tm.isRunning = false;
      tm.isPaused = true;
      tm.isFinished = false;
      tm.remainingAtPause = tm.timeRemainingMs;
      tm.bgWorker.postMessage({ command: "stop" });
      tm.releaseWakeLock();
      tm.updateTitle("");
      tm.updateUIState();
      return;
    }

    let duration;

    if (tm.isPaused) {
      duration = tm.remainingAtPause;
      tm.timeRemainingMs = duration;
    } else {
      const h = parseInt(tm.els.h?.value, 10) || 0;
      const m = parseInt(tm.els.m?.value, 10) || 0;
      const s = parseInt(tm.els.s?.value, 10) || 0;
      tm.totalDuration = (h * 3600 + m * 60 + s) * 1000;
      duration = tm.totalDuration;
      tm.timeRemainingMs = tm.totalDuration;
      tm.currentAdjustmentSec = 0;
    }

    if (duration <= 0) {
      showToast(tm.t("timer_zero"));
      const elToShake = tm.els.form || tm.els.inputs;
      elToShake.classList.add("animate-shake");
      setTimeout(() => elToShake.classList.remove("animate-shake"), 300);
      return;
    }

    tm.store.activate("timer");
    tm.isRunning = true;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.targetTime = performance.now() + duration;
    tm.requestWakeLock();
    tm.updateUIState();
    tm.updateDisplay(duration);
    tm.updateAdjustButtons();

    tm.bgWorker.postMessage({ command: "start", time: duration });
  };

  tm.restart = () => {
    tm.sm.vibrate(30, "medium");
    tm.sm.play("click");

    let duration = tm.totalDuration;

    if (!duration || duration <= 0) {
      const h = parseInt(tm.els.h?.value, 10) || 0;
      const m = parseInt(tm.els.m?.value, 10) || 0;
      const s = parseInt(tm.els.s?.value, 10) || 0;
      duration = (h * 3600 + m * 60 + s) * 1000;
      tm.totalDuration = duration;
    }

    if (duration <= 0) {
      showToast(tm.t("timer_zero"));
      return;
    }

    tm.store.activate("timer");
    tm.isRunning = true;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.remainingAtPause = 0;
    tm.timeRemainingMs = duration;
    tm.targetTime = performance.now() + duration;
    tm.currentAdjustmentSec = 0;

    tm.requestWakeLock();
    tm.updateUIState();
    tm.updateDisplay(duration);
    tm.updateAdjustButtons();
    tm.bgWorker.postMessage({ command: "start", time: duration });
  };

  tm.reset = (clearInputs = true) => {
    tm.sm.vibrate(30, "medium");
    tm.sm.play("click");

    tm.store.clearActiveTimer();

    tm.isRunning = false;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.remainingAtPause = 0;
    tm.totalDuration = 0;
    tm.timeRemainingMs = 0;

    tm.bgWorker.postMessage({ command: "reset" });
    tm.releaseWakeLock();
    tm.updateTitle("");

    if (clearInputs) {
      if (tm.els.h) tm.els.h.value = "00";
      if (tm.els.m) tm.els.m.value = "00";
      if (tm.els.s) tm.els.s.value = "00";
    }

    tm.updateUIState();

    if (tm.els.ring) {
      tm.els.ring.style.strokeDashoffset = tm.ringLength;
    }

    updateText(tm.els.display, "GO");
    tm.els.display.classList.add("is-go");
  };

  tm.bindCoreEvents = () => {
    document.addEventListener(APP_EVENTS.TIMER_STARTED, (e) => {
      if (e.detail !== "timer" && tm.isRunning) tm.toggle();
    });

    tm.els.circleBtn?.addEventListener("click", () => tm.toggle());
    tm.els.resetBtn?.addEventListener("click", () => tm.reset(true));
    tm.els.restartBtn?.addEventListener("click", () => tm.restart());

    tm.bgWorker.addEventListener("message", (e) => {
      if (e.data?.type !== "tick") return;

      const remaining = e.data.time;
      tm.timeRemainingMs = remaining;

      if (tm.isRunning) {
        tm.targetTime = performance.now() + remaining;
        tm.updateDisplay(remaining);
        tm.updateAdjustButtons();
      }

      if (remaining <= 0 && tm.isRunning) {
        tm.isRunning = false;
        tm.isPaused = false;
        tm.isFinished = true;
        tm.timeRemainingMs = 0;
        tm.remainingAtPause = 0;

        tm.store.clearActiveTimer();
        tm.releaseWakeLock();
        tm.updateTitle("");
        tm.updateUIState();

        tm.sm.vibrate([200, 100, 200, 100, 400], "strong");
        tm.sm.play("complete");
        tm.announceToScreenReader(tm.t("timer_finished"));

        requestAnimationFrame(() => {
          showToast(tm.t("timer_finished"));
        });
      }
    });

    tm.els.adjustPlusBtn?.addEventListener("click", () => {
      tm.sm.play("tick");
      tm.sm.vibrate(50, "medium");
      const adjustmentMs = tm.currentAdjustmentSec * 1000;
      tm.totalDuration += adjustmentMs;
      tm.bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
    });

    tm.els.adjustMinusBtn?.addEventListener("click", () => {
      tm.sm.play("tick");
      tm.sm.vibrate(50, "medium");
      const adjustmentMs = -tm.currentAdjustmentSec * 1000;
      tm.totalDuration += adjustmentMs;
      tm.bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
    });
  };
}
