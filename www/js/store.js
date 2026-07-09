// Файл: www/js/store.js

import { safeSetLS, safeGetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { emitAppEvent } from "./events/app-events.js?v=VERSION";

const KNOWN_TIMERS = new Set(["stopwatch", "timer", "tabata"]);

/**
 * @param {string | null} value
 * @returns {string | null}
 */
function normalizeActiveTimer(value) {
  if (!value) return null;
  const v = String(value).trim();
  return KNOWN_TIMERS.has(v) ? v : null;
}

const storeData = {
  activeTimer: normalizeActiveTimer(safeGetLS(STORAGE_KEYS.ACTIVE_TIMER)),
};

function emitActiveTimerChanged(value) {
  emitAppEvent(APP_EVENTS.ACTIVE_TIMER_CHANGED, { activeTimer: value });
}

export const store = {
  activate(timerName) {
    const normalized = normalizeActiveTimer(timerName);
    if (!normalized) return;

    emitAppEvent(APP_EVENTS.TIMER_STARTED, normalized);
    this.setActiveTimer(normalized);
  },

  setActiveTimer(timerName) {
    const next = normalizeActiveTimer(timerName);

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
    return storeData.activeTimer === normalizeActiveTimer(timerName);
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

    const hasRealActive =
      hasRunningStopwatch || hasRunningTimer || hasRunningTabata;

    if (!hasRealActive && storeData.activeTimer) {
      this.clearActiveTimer();
    }
  },
};
