// Файл: www/js/store.js

import { safeSetLS, safeGetLS } from "./utils.js?v=VERSION";

const storeData = {
  activeTimer: safeGetLS("active_timer") || null,
};

export const store = {
  activate(timerName) {
    document.dispatchEvent(
      new CustomEvent("timerStarted", { detail: timerName }),
    );
    this.setActiveTimer(timerName);
  },

  setActiveTimer(timerName) {
    storeData.activeTimer = timerName;
    safeSetLS("active_timer", timerName);
    document.dispatchEvent(
      new CustomEvent("activeTimerChanged", {
        detail: { activeTimer: timerName },
      }),
    );
  },

  getActiveTimer() {
    return storeData.activeTimer;
  },

  isActive(timerName) {
    return storeData.activeTimer === timerName;
  },

  clearActiveTimer() {
    storeData.activeTimer = null;
    safeSetLS("active_timer", "");
    document.dispatchEvent(
      new CustomEvent("activeTimerChanged", {
        detail: { activeTimer: null },
      }),
    );
  },
};
