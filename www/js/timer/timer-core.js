// Файл: www/js/timer/timer-core.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";

const TIMER_ALARM_REQUEST_CODE = 1001;

async function scheduleExactTimerAlarm(epochMs) {
  const bridge = window.Capacitor?.Plugins?.TimerAlarmBridge;
  if (!bridge?.scheduleExact)
    return { scheduled: false, reason: "bridge_missing" };

  try {
    const res = await bridge.scheduleExact({
      epochMs,
      requestCode: TIMER_ALARM_REQUEST_CODE,
    });

    if (
      res &&
      res.scheduled === false &&
      res.reason === "cannot_schedule_exact_alarm"
    ) {
      return res;
    }

    return res || { scheduled: true };
  } catch (e) {
    console.warn("[timer-alarm] schedule failed", e);
    return { scheduled: false, reason: "schedule_failed" };
  }
}

async function cancelExactTimerAlarm() {
  const bridge = window.Capacitor?.Plugins?.TimerAlarmBridge;
  if (!bridge?.cancel) return { canceled: false, reason: "bridge_missing" };

  try {
    const res = await bridge.cancel({ requestCode: TIMER_ALARM_REQUEST_CODE });
    return res || { canceled: true };
  } catch (e) {
    console.warn("[timer-alarm] cancel failed", e);
    return { canceled: false, reason: "cancel_failed" };
  }
}

export function setupTimerCore(tm, { showToast, updateText }) {
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

      const rem = Math.max(0, tm.targetEpochMs - Date.now());
      tm.lastUiRem = rem;
      tm.timeRemainingMs = rem;

      if (tm.ringCtrl && tm.totalDuration > 0) {
        const safeTotal = Math.max(1, tm.totalDuration);
        const progress = Math.max(0, Math.min(1, rem / safeTotal));
        const targetOffset = tm.ringLength * progress;
        tm.ringCtrl.setTarget(targetOffset);
      }

      // Paint ~30fps for stable p95.
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
    cancelExactTimerAlarm();

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

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.TIMER_COMPLETED, {
        detail: {
          at: Date.now(),
          duration: tm.totalDuration,
        },
      }),
    );
  };

  tm.toggle = async () => {
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
      tm.stopUiLoop();
      await cancelExactTimerAlarm();
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

    tm.store.activate("timer");
    tm.isRunning = true;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.targetEpochMs = Date.now() + duration;
    tm.lastUiRem = duration;
    tm._lastUiPaintTs = 0;
    tm.skipWorkerTickUntil = 0;

    tm.requestWakeLock();
    tm.updateUIState();
    tm.updateDisplay(duration);
    tm.updateAdjustButtons();

    if (tm.ringCtrl && tm.totalDuration > 0) {
      const progress = Math.max(
        0,
        Math.min(1, duration / Math.max(1, tm.totalDuration)),
      );
      tm.ringCtrl.snap(tm.ringLength * progress);
    }

    tm.startUiLoop();
    tm.bgWorker.postMessage({ command: "start", time: duration });

    const scheduled = await scheduleExactTimerAlarm(tm.targetEpochMs);
    if (
      scheduled?.scheduled === false &&
      scheduled?.reason === "cannot_schedule_exact_alarm"
    ) {
      showToast("Enable exact alarms for precise background timer");
    }
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

    tm.totalDuration = duration;
    tm.store.activate("timer");
    tm.isRunning = true;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.remainingAtPause = 0;
    tm.timeRemainingMs = duration;
    tm.targetEpochMs = Date.now() + duration;
    tm.lastUiRem = duration;
    tm.currentAdjustmentSec = 0;
    tm._lastUiPaintTs = 0;
    tm.skipWorkerTickUntil = 0;

    tm.requestWakeLock();
    tm.updateUIState();
    tm.updateDisplay(duration);
    tm.updateAdjustButtons();

    if (tm.ringCtrl) tm.ringCtrl.snap(tm.ringLength);

    tm.startUiLoop();
    tm.bgWorker.postMessage({ command: "start", time: duration });

    const scheduled = await scheduleExactTimerAlarm(tm.targetEpochMs);
    if (
      scheduled?.scheduled === false &&
      scheduled?.reason === "cannot_schedule_exact_alarm"
    ) {
      showToast("Enable exact alarms for precise background timer");
    }
  };

  tm.reset = async (clearInputs = true) => {
    tm.sm.vibrate(30, "medium");
    tm.sm.play("click");

    tm.store.clearActiveTimer();

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
    await cancelExactTimerAlarm();
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
  };

  tm.bindCoreEvents = () => {
    document.addEventListener(APP_EVENTS.TIMER_STARTED, (e) => {
      if (e.detail !== "timer" && tm.isRunning) tm.toggle();
    });

    tm.els.circleBtn?.addEventListener("click", () => tm.toggle());
    tm.els.resetBtn?.addEventListener("click", () => tm.reset(true));
    tm.els.restartBtn?.addEventListener("click", () => tm.restart());

    tm.bgWorker.addEventListener("message", async (e) => {
      if (e.data?.type !== "tick") return;

      const remaining = e.data.time;
      const nowPerf = performance.now();
      const nowEpoch = Date.now();

      if (
        tm.skipWorkerTickUntil &&
        nowPerf < tm.skipWorkerTickUntil &&
        remaining > 0
      ) {
        return;
      }

      tm.timeRemainingMs = remaining;

      if (tm.isRunning) {
        const predicted = Math.max(0, tm.targetEpochMs - nowEpoch);
        if (Math.abs(predicted - remaining) > 220) {
          tm.targetEpochMs = nowEpoch + remaining;
          await scheduleExactTimerAlarm(tm.targetEpochMs);
        }
      }

      if (document.hidden && tm.isRunning) {
        const forceHours = tm.totalDuration >= 3600000;
        tm.updateTitle(tm.formatTime(remaining, { forceHours }));
      }

      if (remaining <= 0 && tm.isRunning) {
        tm.finishAsCompleted();
      }
    });

    tm.els.adjustPlusBtn?.addEventListener("click", async () => {
      tm.sm.play("tick");
      tm.sm.vibrate(50, "medium");

      const adjustmentMs = tm.currentAdjustmentSec * 1000;

      tm.totalDuration = Math.max(1, tm.totalDuration + adjustmentMs);
      tm.timeRemainingMs = Math.max(0, tm.timeRemainingMs + adjustmentMs);
      tm.targetEpochMs = Date.now() + tm.timeRemainingMs;
      tm.lastUiRem = tm.timeRemainingMs;

      tm.skipWorkerTickUntil = performance.now() + 180;

      if (tm.ringCtrl && tm.totalDuration > 0) {
        const p = Math.max(
          0,
          Math.min(1, tm.timeRemainingMs / Math.max(1, tm.totalDuration)),
        );
        tm.ringCtrl.setTarget(tm.ringLength * p);
      }

      tm.updateDisplay(tm.timeRemainingMs);
      tm.updateAdjustButtons();

      tm.bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
      await scheduleExactTimerAlarm(tm.targetEpochMs);
    });

    tm.els.adjustMinusBtn?.addEventListener("click", async () => {
      tm.sm.play("tick");
      tm.sm.vibrate(50, "medium");

      const adjustmentMs = -tm.currentAdjustmentSec * 1000;

      tm.totalDuration = Math.max(1, tm.totalDuration + adjustmentMs);
      tm.timeRemainingMs = Math.max(0, tm.timeRemainingMs + adjustmentMs);
      tm.targetEpochMs = Date.now() + tm.timeRemainingMs;
      tm.lastUiRem = tm.timeRemainingMs;

      tm.skipWorkerTickUntil = performance.now() + 180;

      if (tm.timeRemainingMs <= 0 && tm.isRunning) {
        tm.bgWorker.postMessage({ command: "reset" });
        tm.finishAsCompleted();
        return;
      }

      if (tm.ringCtrl && tm.totalDuration > 0) {
        const p = Math.max(
          0,
          Math.min(1, tm.timeRemainingMs / Math.max(1, tm.totalDuration)),
        );
        tm.ringCtrl.setTarget(tm.ringLength * p);
      }

      tm.updateDisplay(tm.timeRemainingMs);
      tm.updateAdjustButtons();

      tm.bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
      await scheduleExactTimerAlarm(tm.targetEpochMs);
    });
  };
}
