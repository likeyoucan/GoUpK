// Файл: www/js/tabata/tabata-core.js

import { sm } from "../sound.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import {
  requestWakeLock,
  releaseWakeLock,
  updateTitle,
  updateText,
  bgWorker,
  animateGoEnter,
} from "../utils.js?v=VERSION";
import { store } from "../store.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";

import { setupTabataLifecycle } from "./tabata-lifecycle.js?v=VERSION";
import { setupTabataBackgroundSync } from "./tabata-background-sync.js?v=VERSION";

export function setupTabataCore(tb) {
  // If core is re-mounted, clean previous layer first
  tb._unbindCoreEvents?.();
  tb._unbindCoreEvents = null;

  setupTabataLifecycle(tb, {
    sm,
    store,
    requestWakeLock,
    releaseWakeLock,
    updateTitle,
    updateText,
    t,
    bgWorker,
    animateGoEnter,
  });

  setupTabataBackgroundSync(tb, {
    APP_EVENTS,
    updateTitle,
    bgWorker,
  });

  // Merge nested unbinders into one core disposer
  tb._unbindCoreEvents = () => {
    try {
      tb._unbindBackgroundSync?.();
      tb._unbindBackgroundSync = null;
    } catch (err) {
      console.error("[tabata-core.dispose.background]", err);
    }
  };
}
