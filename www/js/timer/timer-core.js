// Файл: www/js/timer/timer-core.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { createTimerAlarmScheduler } from "./timer-alarm.js?v=VERSION";
import { animateGoEnter } from "../utils.js?v=VERSION";
import { emitAppEvent } from "../events/app-events.js?v=VERSION";
import { getProgressOffset } from "../core/timers-runtime.js?v=VERSION";
import { shouldSkipWorkerTick } from "../core/runtime-reconcile.js?v=VERSION";
import { createCountdownEngine } from "../core/timer-engine.js?v=VERSION";
import { applyTimerEngineSnapshot } from "../core/engine-adapters.js?v=VERSION";

export function setupTimerCore(tm, { showToast, updateText }) {
  const alarmScheduler =
    tm.alarmScheduler || createTimerAlarmScheduler({ requestCode: 1001 });
  tm.alarmScheduler = alarmScheduler;

  tm.countdownEngine =
    tm.countdownEngine ||
    createCountdownEngine({
      now: () => Date.now(),
      rebaseThresholdMs: 220,
    });

  tm._unbindCoreEvents = tm._unbindCoreEvents || null;

  tm.getRemainingTime = () => {
    if (!tm.isRunning && !tm.isPaused && !tm.isFinished) return 0;
    return tm.timeRemainingMs;
  };

  tm.startUiLoop = () => {
    if (tm.rAF) cancelAnimationFrame(tm.rAF);

    const loop = () => {
      if (!tm.isRunning) {
        tm.rAF = null;
        return;
      }

      const rem = tm.countdownEngine.getRemaining();
      tm.lastUiRem = rem;
      tm.timeRemainingMs = rem;

      if (tm.ringCtrl && tm.totalDuration > 0) {
        const targetOffset = getProgressOffset({
          remainingMs: rem,
          totalMs: tm.totalDuration,
          ringLength: tm.ringLength,
        });
        tm.ringCtrl.setTarget(targetOffset);
      }

      const nowPerf = performance.now();
      if (nowPerf - (tm._lastUiPaintTs || 0) >= 33) {
        tm._lastUiPaintTs = nowPerf;
        tm.updateDisplay(rem);
        tm.updateAdjustButtons();
      }

      if (rem <= 0 && tm.isRunning) {
        tm.finishAsCompleted();
        tm.rAF = null;
        return;
      }

      tm.rAF = requestAnimationFrame(loop);
    };

    tm.rAF = requestAnimationFrame(loop);
  };

  tm.stopUiLoop = () => {
    if (tm.rAF) cancelAnimationFrame(tm.rAF);
    tm.rAF = null;
  };

  tm.finishAsCompleted = () => {
    tm.countdownEngine.stop();

    tm.isRunning = false;
    tm.isPaused = false;
    tm.isFinished = true;
    tm.timeRemainingMs = 0;
    tm.remainingAtPause = 0;
    tm.targetEpochMs = 0;

    tm.updateDisplay(0);
    if (tm.ringCtrl) tm.ringCtrl.snap(0);
    else if (tm.els?.ring) tm.els.ring.style.strokeDashoffset = 0;

    tm.bgWorker.postMessage({ command: "reset" });
    cancelExactAlarmSilently();

    tm.store.clearActiveTimer();
    tm.stopUiLoop();
    tm.releaseWakeLock();
    tm.updateTitle("");
    tm.updateUIState();

    tm.sm.vibrate([200, 100, 200, 100, 400], "strong");
    tm.sm.play("complete");
    tm.announceToScreenReader(tm.t("timer_finished"));

    requestAnimationFrame(() => {
      showToast(tm.t("timer_finished"));
    });

    emitAppEvent(APP_EVENTS.TIMER_COMPLETED, {
      at: Date.now(),
      duration: tm.totalDuration,
    });
  };

  function logExactAlarmHintOnce() {
    try {
      const key = "__exact_alarm_hint_logged_once__";
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
      console.warn(
        "[timer] Exact alarms are not allowed. Background precision may be reduced.",
      );
    } catch {
      console.warn(
        "[timer] Exact alarms are not allowed. Background precision may be reduced.",
      );
    }
  }

function scheduleExactAlarmAndHandleHint(targetEpochMs) {
  void alarmScheduler
    .schedule(targetEpochMs)
    .then((scheduled) => {
      if (
        scheduled?.scheduled === false &&
        scheduled?.reason === "cannot_schedule_exact_alarm"
      ) {
        logExactAlarmHintOnce();
      }
    })
    .catch(() => {});
}

function cancelExactAlarmSilently() {
  void alarmScheduler.cancel().catch(() => {});
}

  tm.toggle = async () => {
    tm.sm.vibrate(40, "light");
    tm.sm.play("click");
    tm.sm.unlock();

    if (tm.isRunning) {
      tm.store.clearActiveTimer();

      const pausedSnap = tm.countdownEngine.pause();
      applyTimerEngineSnapshot(tm, pausedSnap);

      tm.remainingAtPause = pausedSnap.remainingMs;
      tm.lastUiRem = pausedSnap.remainingMs;
      tm.targetEpochMs = 0;

      tm.isRunning = false;
      tm.isPaused = true;
      tm.isFinished = false;

      tm.bgWorker.postMessage({ command: "stop" });
      tm.stopUiLoop();
      cancelExactAlarmSilently();
      tm.releaseWakeLock();
      tm.updateTitle("");
      tm.updateDisplay(pausedSnap.remainingMs);
      tm.updateUIState();
      return;
    }

    let duration;

    if (tm.isPaused) {
      const snap = tm.countdownEngine.resume();
      applyTimerEngineSnapshot(tm, snap);
      duration = snap.remainingMs;
      tm.timeRemainingMs = duration;
    } else {
      const h = parseInt(tm.els.h?.value, 10) || 0;
      const m = parseInt(tm.els.m?.value, 10) || 0;
      const s = parseInt(tm.els.s?.value, 10) || 0;

      const parsedDuration = (h * 3600 + m * 60 + s) * 1000;
      tm.initialDurationMs = parsedDuration;
      tm.totalDuration = parsedDuration;

      duration = tm.totalDuration;
      tm.timeRemainingMs = tm.totalDuration;
      tm.currentAdjustmentSec = 0;
    }

    if (duration <= 0) {
      showToast(tm.t("timer_zero"));
      const elToShake = tm.els.form || tm.els.inputs;
      elToShake?.classList.add("animate-shake");
      setTimeout(() => elToShake?.classList.remove("animate-shake"), 300);
      return;
    }

    if (!tm.isPaused) {
      const startSnap = tm.countdownEngine.start(duration);
      applyTimerEngineSnapshot(tm, startSnap);
    }

    tm.store.activate("timer");
    tm.isRunning = true;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.lastUiRem = tm.timeRemainingMs;
    tm._lastUiPaintTs = 0;
    tm.skipWorkerTickUntil = 0;

    tm.requestWakeLock();
    tm.updateUIState();

    requestAnimationFrame(() => {
      tm.updateDisplay(tm.timeRemainingMs);
      tm.updateAdjustButtons();

      if (tm.ringCtrl && tm.totalDuration > 0) {
        const targetOffset = getProgressOffset({
          remainingMs: tm.timeRemainingMs,
          totalMs: tm.totalDuration,
          ringLength: tm.ringLength,
        });
        tm.ringCtrl.snap(targetOffset);
      }

      tm.startUiLoop();
    });

    tm.bgWorker.postMessage({ command: "start", time: tm.timeRemainingMs });
    scheduleExactAlarmAndHandleHint(tm.targetEpochMs);
  };

  tm.restart = async () => {
    tm.sm.vibrate(30, "medium");
    tm.sm.play("click");

    let duration = tm.initialDurationMs;

    if (!duration || duration <= 0) {
      const h = parseInt(tm.els.h?.value, 10) || 0;
      const m = parseInt(tm.els.m?.value, 10) || 0;
      const s = parseInt(tm.els.s?.value, 10) || 0;
      duration = (h * 3600 + m * 60 + s) * 1000;
      tm.initialDurationMs = duration;
    }

    if (duration <= 0) {
      showToast(tm.t("timer_zero"));
      return;
    }

    const startSnap = tm.countdownEngine.start(duration);
    applyTimerEngineSnapshot(tm, startSnap);

    tm.totalDuration = duration;
    tm.store.activate("timer");
    tm.isRunning = true;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.remainingAtPause = 0;
    tm.lastUiRem = startSnap.remainingMs;
    tm.currentAdjustmentSec = 0;
    tm._lastUiPaintTs = 0;
    tm.skipWorkerTickUntil = 0;

    tm.requestWakeLock();
    tm.updateUIState();

    requestAnimationFrame(() => {
      tm.updateDisplay(startSnap.remainingMs);
      tm.updateAdjustButtons();

      if (tm.ringCtrl) tm.ringCtrl.snap(tm.ringLength);

      tm.startUiLoop();
    });

    tm.bgWorker.postMessage({ command: "start", time: startSnap.remainingMs });
    scheduleExactAlarmAndHandleHint(tm.targetEpochMs);
  };

  tm.reset = async (clearInputs = true) => {
    tm.sm.vibrate(30, "medium");
    tm.sm.play("click");

    tm.store.clearActiveTimer();
    tm.countdownEngine.stop();

    tm.isRunning = false;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.remainingAtPause = 0;
    tm.totalDuration = 0;
    tm.initialDurationMs = 0;
    tm.timeRemainingMs = 0;
    tm.targetEpochMs = 0;
    tm.lastUiRem = 0;
    tm._lastUiPaintTs = 0;
    tm.skipWorkerTickUntil = 0;

    tm.bgWorker.postMessage({ command: "reset" });
    cancelExactAlarmSilently();
    tm.stopUiLoop();
    tm.releaseWakeLock();
    tm.updateTitle("");

    if (clearInputs) {
      if (tm.els.h) tm.els.h.value = "00";
      if (tm.els.m) tm.els.m.value = "00";
      if (tm.els.s) tm.els.s.value = "00";
    }

    tm.updateUIState();

    if (tm.ringCtrl) tm.ringCtrl.snap(tm.ringLength);
    else if (tm.els.ring) tm.els.ring.style.strokeDashoffset = tm.ringLength;

    updateText(tm.els.display, "GO");
    tm.els.display?.classList.add("is-go");
    animateGoEnter(tm.els.display);
    if (tm.els.display) tm.els.display.style.transform = "";
  };

  tm.bindCoreEvents = () => {
    tm._unbindCoreEvents?.();

    const disposers = [];

    const onTimerStarted = (e) => {
      if (e.detail !== "timer" && tm.isRunning) {
        void tm.toggle();
      }
    };
    document.addEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted);
    disposers.push(() =>
      document.removeEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted),
    );

    const onCircleClick = () => void tm.toggle();
    tm.els.circleBtn?.addEventListener("click", onCircleClick);
    disposers.push(() =>
      tm.els.circleBtn?.removeEventListener("click", onCircleClick),
    );

    const onResetClick = () => void tm.reset(true);
    tm.els.resetBtn?.addEventListener("click", onResetClick);
    disposers.push(() =>
      tm.els.resetBtn?.removeEventListener("click", onResetClick),
    );

    const onRestartClick = () => void tm.restart();
    tm.els.restartBtn?.addEventListener("click", onRestartClick);
    disposers.push(() =>
      tm.els.restartBtn?.removeEventListener("click", onRestartClick),
    );

    const onWorkerMessage = (e) => {
      if (e.data?.type !== "tick") return;
      if (!tm.isRunning) return;

      const remaining = e.data.time;
      const nowPerf = performance.now();

      if (
        shouldSkipWorkerTick({
          skipWorkerTickUntil: tm.skipWorkerTickUntil,
          nowPerf,
          workerRemainingMs: remaining,
        })
      ) {
        return;
      }

      tm.timeRemainingMs = remaining;

      const prevTarget = tm.targetEpochMs;
      const snap = tm.countdownEngine.rebaseFromWorker(remaining);
      applyTimerEngineSnapshot(tm, snap);

      if (snap.rebased && tm.targetEpochMs !== prevTarget) {
        scheduleExactAlarmAndHandleHint(tm.targetEpochMs);
      }

      if (document.hidden) {
        const forceHours = tm.totalDuration >= 3600000;
        tm.updateTitle(tm.formatTime(remaining, { forceHours }));
      }

      if (remaining <= 0) {
        tm.finishAsCompleted();
      }
    };

    tm.bgWorker.addEventListener("message", onWorkerMessage);
    disposers.push(() =>
      tm.bgWorker.removeEventListener("message", onWorkerMessage),
    );

    const onAdjustPlus = () => {
      tm.sm.play("tick");
      tm.sm.vibrate(50, "medium");

      const adjustmentMs = tm.currentAdjustmentSec * 1000;
      const snap = tm.countdownEngine.adjust(adjustmentMs);
      applyTimerEngineSnapshot(tm, snap);

      tm.skipWorkerTickUntil = performance.now() + 180;
      tm.lastUiRem = tm.timeRemainingMs;

      if (tm.ringCtrl && tm.totalDuration > 0) {
        const targetOffset = getProgressOffset({
          remainingMs: tm.timeRemainingMs,
          totalMs: tm.totalDuration,
          ringLength: tm.ringLength,
        });
        tm.ringCtrl.setTarget(targetOffset);
      }

      tm.updateDisplay(tm.timeRemainingMs);
      tm.updateAdjustButtons();

      tm.bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
      scheduleExactAlarmAndHandleHint(tm.targetEpochMs);
    };

    tm.els.adjustPlusBtn?.addEventListener("click", onAdjustPlus);
    disposers.push(() =>
      tm.els.adjustPlusBtn?.removeEventListener("click", onAdjustPlus),
    );

    const onAdjustMinus = () => {
      tm.sm.play("tick");
      tm.sm.vibrate(50, "medium");

      const adjustmentMs = -tm.currentAdjustmentSec * 1000;
      const snap = tm.countdownEngine.adjust(adjustmentMs);
      applyTimerEngineSnapshot(tm, snap);

      tm.skipWorkerTickUntil = performance.now() + 180;
      tm.lastUiRem = tm.timeRemainingMs;

      if (tm.timeRemainingMs <= 0 && tm.isRunning) {
        tm.bgWorker.postMessage({ command: "reset" });
        tm.finishAsCompleted();
        return;
      }

      if (tm.ringCtrl && tm.totalDuration > 0) {
        const targetOffset = getProgressOffset({
          remainingMs: tm.timeRemainingMs,
          totalMs: tm.totalDuration,
          ringLength: tm.ringLength,
        });
        tm.ringCtrl.setTarget(targetOffset);
      }

      tm.updateDisplay(tm.timeRemainingMs);
      tm.updateAdjustButtons();

      tm.bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
      scheduleExactAlarmAndHandleHint(tm.targetEpochMs);
    };

    tm.els.adjustMinusBtn?.addEventListener("click", onAdjustMinus);
    disposers.push(() =>
      tm.els.adjustMinusBtn?.removeEventListener("click", onAdjustMinus),
    );

    tm._unbindCoreEvents = () => {
      disposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[timer-core.dispose]", err);
        }
      });
    };
  };
}
