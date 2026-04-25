// Файл: www/js/store.js

import { safeSetLS, safeGetLS } from "./utils.js?v=VERSION";

const storeData = {
  activeTimer: safeGetLS("active_timer") || null,
};

export const store = {
  setActiveTimer(timerName) {
    storeData.activeTimer = timerName;
    safeSetLS("active_timer", timerName);
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
  },
};
