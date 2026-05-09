// Файл: www/js/store.js

import { safeSetLS, safeGetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";

const storeData = {
  activeTimer: safeGetLS(STORAGE_KEYS.ACTIVE_TIMER) || null,
};

function emitActiveTimerChanged(value) {
  document.dispatchEvent(
    new CustomEvent(APP_EVENTS.ACTIVE_TIMER_CHANGED, {
      detail: { activeTimer: value },
    }),
  );
}

export const store = {
  activate(timerName) {
    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.TIMER_STARTED, { detail: timerName }),
    );
    this.setActiveTimer(timerName);
  },

  setActiveTimer(timerName) {
    const next = timerName || null;
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

    const hasRealActive =
      hasRunningStopwatch || hasRunningTimer || hasRunningTabata;

    if (!hasRealActive && storeData.activeTimer) {
      this.clearActiveTimer();
    }
  },
};
