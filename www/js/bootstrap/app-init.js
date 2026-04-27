// Файл: www/js/bootstrap/app-init.js

import { createModalConfig } from "./modal-config.js?v=VERSION";

/**
 * Централизованный bootstrap-пайплайн.
 * Сохраняем порядок инициализации, чтобы не ловить race conditions.
 */
export function initializeApp({
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
}) {
  applyPerformanceProfile();
  initRingSvg();

  langManager.init();
  initTouchRanges();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();

  const modalConfig = createModalConfig({ sw, tb });
  modalManager.init(modalConfig);
}