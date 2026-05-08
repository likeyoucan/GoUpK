// Файл: www/js/main.js

import { $, showToast } from "./utils.js?v=VERSION";
import { langManager, t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { initTouchRanges } from "./touch-range.js?v=VERSION";
import { preload } from "./preload.js?v=VERSION";
import {
  initForegroundService,
  destroyForegroundService,
} from "./foreground-service.js?v=VERSION";

import { initRingSvg } from "./bootstrap/ring-svg-injector.js?v=VERSION";
import { applyPerformanceProfile } from "./bootstrap/performance-profile.js?v=VERSION";
import { bindAppLifecycle } from "./bootstrap/app-lifecycle.js?v=VERSION";
import { initializeApp } from "./bootstrap/app-init.js?v=VERSION";
import { bindUiInteractions } from "./bootstrap/ui-interactions.js?v=VERSION";

import { appProManager } from "./app-pro.js?v=VERSION";
import { adsManager } from "./ads.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

document.addEventListener("DOMContentLoaded", async () => {
  initializeApp({
    applyPerformanceProfile,
    initRingSvg,
    langManager,
    initTouchRanges,
    themeManager,
    sm,
    sw,
    tm,
    tb,
    navigation,
    modalManager,
  });

  await appProManager.init();

  adsManager.init();
  adsManager.bindAutoRefresh();
  adsManager.bindLifecycleMonetization();

  bindAppLifecycle({
    preload,
    initForegroundService,
    destroyForegroundService,
    modalManager,
    navigation,
  });

  bindUiInteractions({
    $,
    showToast,
    t,
    modalManager,
    themeManager,
    sm,
    langManager,
    sw,
    tm,
    tb,
    navigation,
  });

  // Runtime integrity re-check
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      appProManager.revalidateOrReset();
    }
  });

  // Generic paywall request feedback
  document.addEventListener(APP_EVENTS.PRO_PAYWALL_REQUESTED, (e) => {
    const feature = e?.detail?.feature || "pro";
    showToast(`Pro required: ${feature}`);
  });
});
