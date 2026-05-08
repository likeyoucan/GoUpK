// Файл: www/js/tabata/tabata-core.js

import {
  requestWakeLock,
  releaseWakeLock,
  updateTitle,
  bgWorker,
  updateText,
} from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { store } from "../store.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";

function startTimerContext() {
  requestWakeLock();
}

function stopTimerContext() {
  releaseWakeLock();
  updateTitle("");
}

export function setupTabataCore(tb) {
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

    bgWorker.postMessage({ command: "start" });
    tb.tick();
  };

  tb.pause = () => {
    store.clearActiveTimer();
    tb.paused = true;

    bgWorker.postMessage({ command: "stop" });

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
    bgWorker.postMessage({ command: "start" });

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

    bgWorker.postMessage({ command: "stop" });

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

  tb.tick = (isBackground = false) => {
    if (tb.status === "STOPPED" || tb.paused || tb.completionHandled) return;
    if (tb.phaseClosing) return;

    const rem = tb.phaseEndTime - Date.now();

    if (rem <= 0) {
      const missed = Math.abs(rem);

      // In background or after long freeze: fast-forward immediately.
      if (document.hidden || missed > 2000) {
        tb.nextPhase(missed);
        return;
      }

      // Foreground visual close-hold before phase switch.
      tb.phaseClosing = true;

      if (!isBackground) tb.render(0);
      tb.ringCtrl?.setTarget(0);

      tb.phaseCloseTimer = setTimeout(() => {
        tb.phaseClosing = false;
        tb.phaseCloseTimer = null;

        if (tb.status !== "STOPPED" && !tb.paused && !tb.completionHandled) {
          tb.nextPhase(0);
        }
      }, 120);

      return;
    }

    const now = performance.now();
    if (now - tb.lastRender >= 16 || isBackground) {
      if (!isBackground) {
        tb.render(rem);
      } else {
        updateTitle(`${tb.status}: ${tb.formatTime(rem)}`);
      }
      tb.lastRender = now;
    }

    if (!isBackground) {
      if (tb.rAF) cancelAnimationFrame(tb.rAF);
      tb.rAF = requestAnimationFrame(() => tb.tick());
    }
  };

  tb.bindCoreEvents = () => {
    tb.els.startBtn?.addEventListener("click", () => tb.toggle());
    tb.els.stopBtn?.addEventListener("click", () => tb.stop());

    document.addEventListener(APP_EVENTS.TIMER_STARTED, (e) => {
      if (e.detail !== "tabata" && tb.status !== "STOPPED" && !tb.paused) {
        tb.pause();
      }
    });

    bgWorker.addEventListener("message", (e) => {
      if (
        e.data?.type === "heartbeat" &&
        tb.status !== "STOPPED" &&
        !tb.paused &&
        !tb.completionHandled &&
        document.hidden
      ) {
        tb.tick(true);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;

      if (tb.status === "STOPPED") {
        if (tb.phaseCloseTimer) {
          clearTimeout(tb.phaseCloseTimer);
          tb.phaseCloseTimer = null;
        }
        tb.phaseClosing = false;
        tb.ringCtrl?.snap(tb.ringLength);
        return;
      }

      if (!tb.paused && !tb.completionHandled) {
        const rem = tb.phaseEndTime - Date.now();

        if (rem <= 0) {
          tb.nextPhase(Math.abs(rem));
          return;
        }

        tb.lastRender = 0;
        tb.phaseClosing = false;
        if (tb.phaseCloseTimer) {
          clearTimeout(tb.phaseCloseTimer);
          tb.phaseCloseTimer = null;
        }
        tb.render(rem);
        tb.tick();
      }
    });
  };
}
