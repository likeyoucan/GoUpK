// Файл: www/js/store.js

import { safeSetLS, safeGetLS, safeRemoveLS } from "./utils.js?v=VERSION";

const storeData = {
  activeTimer: safeGetLS("active_timer") || null,
};

function emitActiveTimerChanged(value) {
  document.dispatchEvent(
    new CustomEvent("activeTimerChanged", {
      detail: { activeTimer: value },
    }),
  );
}

export const store = {
  activate(timerName) {
    document.dispatchEvent(
      new CustomEvent("timerStarted", { detail: timerName }),
    );
    this.setActiveTimer(timerName);
  },

  setActiveTimer(timerName) {
    const next = timerName || null;
    if (storeData.activeTimer === next) return;

    storeData.activeTimer = next;

    if (next) safeSetLS("active_timer", next);
    else safeRemoveLS("active_timer");

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
