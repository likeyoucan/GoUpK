// Файл: www/js/bootstrap/app-init.js

import { createModalConfig } from "./modal-config.js?v=VERSION";

/**
 * Централизованный bootstrap-пайплайн.
 * Порядок важен: сначала среда, потом менеджеры, потом таймеры/вьюхи.
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
  navigation.refreshPanelLayout?.(true);

  const modalConfig = createModalConfig({ sw, tb });
  modalManager.init(modalConfig);

  // Второй проход после инициализации всех view.
  requestAnimationFrame(() => {
    navigation.refreshPanelLayout?.(true);
  });
}
