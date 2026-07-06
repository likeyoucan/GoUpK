// Файл: www/js/store.js

import { safeSetLS, safeGetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { emitAppEvent } from "./events/app-events.js?v=VERSION";

const VALID_TIMERS = new Set(["stopwatch", "timer", "tabata"]);

const storeData = {
  activeTimer: safeGetLS(STORAGE_KEYS.ACTIVE_TIMER) || null,
};

function emitActiveTimerChanged(value) {
  emitAppEvent(APP_EVENTS.ACTIVE_TIMER_CHANGED, { activeTimer: value });
}

function normalizeTimerName(timerName) {
  return VALID_TIMERS.has(timerName) ? timerName : null;
}

export const store = {
  activate(timerName) {
    const normalized = normalizeTimerName(timerName);
    if (!normalized) return;

    this.setActiveTimer(normalized);
    emitAppEvent(APP_EVENTS.TIMER_STARTED, normalized);
  },

  setActiveTimer(timerName) {
    const next = normalizeTimerName(timerName);
    if (storeData.activeTimer === next) return;

    storeData.activeTimer = next;

    if (next) safeSetLS(STORAGE_KEYS.ACTIVE_TIMER, next);
    else safeRemoveLS(STORAGE_KEYS.ACTIVE_TIMER);

    emitActiveTimerChanged(next);
  },

  getActiveTimer() {
    return storeData.activeTimer;
  },

  isActive(timerName) {
    return storeData.activeTimer === timerName;
  },

  clearActiveTimer() {
    this.setActiveTimer(null);
  },

  // Reconcile persisted ACTIVE_TIMER with real runtime state after process restore.
  reconcileActiveTimer({ sw, tm, tb }) {
    const hasRunningStopwatch = !!sw?.isRunning;
    const hasRunningTimer = !!tm?.isRunning;
    const hasRunningTabata =
      !!tb?.status && tb.status !== "STOPPED" && !tb?.paused;

    const hasPausedStopwatch = !sw?.isRunning && (sw?.elapsedTime || 0) > 0;
    const hasPausedTimer =
      !!tm?.isPaused &&
      (typeof tm?.getRemainingTime === "function"
        ? tm.getRemainingTime() > 0
        : (tm?.remainingAtPause || tm?.timeRemainingMs || 0) > 0);

    const hasPausedTabata =
      !!tb?.paused &&
      tb?.status !== "STOPPED" &&
      (tb?.remainingAtPause || 0) > 0;

    if (hasRunningStopwatch) {
      this.setActiveTimer("stopwatch");
      return;
    }

    if (hasRunningTimer) {
      this.setActiveTimer("timer");
      return;
    }

    if (hasRunningTabata) {
      this.setActiveTimer("tabata");
      return;
    }

    // If nothing is actively running, keep only resumable states.
    if (hasPausedStopwatch) {
      this.setActiveTimer("stopwatch");
      return;
    }

    if (hasPausedTimer) {
      this.setActiveTimer("timer");
      return;
    }

    if (hasPausedTabata) {
      this.setActiveTimer("tabata");
      return;
    }

    this.clearActiveTimer();
  },
};
