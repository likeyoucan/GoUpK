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
};
