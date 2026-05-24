// Файл: www/js/bootstrap/runtime-bootstrap.js

import { initializeApp } from "./app-init.js?v=VERSION";
import { bindAppLifecycle } from "./app-lifecycle.js?v=VERSION";
import { bindUiInteractions } from "./ui-interactions.js?v=VERSION";

export function initRuntimeBootstrap({
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
  preload,
  initForegroundService,
  destroyForegroundService,
  adsManager,
  showToast,
  t,
  getById,
}) {
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

  bindAppLifecycle({
    preload,
    initForegroundService,
    destroyForegroundService,
    modalManager,
    navigation,
    adsManager,
  });

  bindUiInteractions({
    $: getById,
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
}
