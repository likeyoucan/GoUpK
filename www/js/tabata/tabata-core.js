// Файл: www/js/tabata/tabata-core.js

import { sm } from "../sound.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import {
  requestWakeLock,
  releaseWakeLock,
  updateTitle,
  updateText,
  bgWorker,
} from "../utils.js?v=VERSION";
import { store } from "../store.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";

import { setupTabataLifecycle } from "./tabata-lifecycle.js?v=VERSION";
import { setupTabataBackgroundSync } from "./tabata-background-sync.js?v=VERSION";

export function setupTabataCore(tb) {
  setupTabataLifecycle(tb, {
    sm,
    store,
    requestWakeLock,
    releaseWakeLock,
    updateTitle,
    updateText,
    t,
    bgWorker,
  });

  setupTabataBackgroundSync(tb, {
    APP_EVENTS,
    updateTitle,
    bgWorker,
  });
}
