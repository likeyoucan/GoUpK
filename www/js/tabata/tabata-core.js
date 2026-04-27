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
    tb.phaseEndTime = performance.now() + tb.phaseDuration;
    tb.paused = false;
    tb.lastBeepSec = 0;

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

    tb.remainingAtPause = tb.phaseEndTime - performance.now();
    updateText(tb.els.status, t("pause"));

    stopTimerContext();
  };

  tb.resume = () => {
    store.activate("tabata");
    tb.paused = false;
    tb.phaseEndTime = performance.now() + tb.remainingAtPause;
    tb.lastBeepSec = 0;

    startTimerContext();
    bgWorker.postMessage({ command: "start" });

    tb.tick();
    tb.updatePhaseStyles();
  };

  tb.stop = () => {
    sm.vibrate(30, "medium");
    sm.play("click");

    store.clearActiveTimer();

    if (tb.els.runningWorkoutName) updateText(tb.els.runningWorkoutName, "");

    bgWorker.postMessage({ command: "stop" });

    if (tb.rAF) cancelAnimationFrame(tb.rAF);
    tb.rAF = null;

    tb.status = "STOPPED";
    tb.paused = false;

    stopTimerContext();

    tb.els.listSection.classList.remove("hidden");
    tb.els.runningControls.classList.remove("flex");
    tb.els.runningControls.classList.add("hidden");
    tb.els.status.classList.add("hidden");

    updateText(tb.els.timer, "GO");
    tb.els.timer.classList.add("is-go");

    if (tb.els.ring) tb.els.ring.style.strokeDashoffset = tb.ringLength;
  };

  tb.tick = (isBackground = false) => {
    if (tb.status === "STOPPED" || tb.paused) return;

    const now = performance.now();
    const rem = tb.phaseEndTime - now;

    if (rem <= 0) {
      const isDeepSleepWakeup = rem < -2000;
      tb.nextPhase(isDeepSleepWakeup ? Math.abs(rem) : 0);
      return;
    }

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

    document.addEventListener("timerStarted", (e) => {
      if (e.detail !== "tabata" && tb.status !== "STOPPED" && !tb.paused) {
        tb.pause();
      }
    });

    bgWorker.addEventListener("message", (e) => {
      if (
        e.data?.type === "heartbeat" &&
        tb.status !== "STOPPED" &&
        !tb.paused &&
        document.hidden
      ) {
        tb.tick(true);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        tb.status !== "STOPPED" &&
        !tb.paused
      ) {
        tb.lastRender = 0;
        tb.tick();
      }
    });
  };
}
