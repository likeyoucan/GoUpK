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

function bindRunAgainButton() {
  const runAgainBtn = $("tm-runAgainBtn");
  if (!runAgainBtn || runAgainBtn.dataset.bound === "1") return;

  runAgainBtn.dataset.bound = "1";
  runAgainBtn.addEventListener("click", () => {
    if (typeof tm.runAgain === "function") {
      tm.runAgain();
      return;
    }

    if (typeof tm.reset === "function") tm.reset(false);
    if (typeof tm.toggle === "function") tm.toggle();
  });
}

document.addEventListener("DOMContentLoaded", () => {
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

  bindRunAgainButton();

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
});
