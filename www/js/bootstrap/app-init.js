// Файл: www/js/bootstrap/app-init.js

import { createModalConfig } from "./modal-config.js?v=VERSION";
import { initDynamicRingAndGoLayout } from "./ring-go-layout.js?v=VERSION";

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
  if (
    !applyPerformanceProfile ||
    !initRingSvg ||
    !langManager ||
    !initTouchRanges ||
    !themeManager ||
    !sm ||
    !sw ||
    !tm ||
    !tb ||
    !navigation ||
    !modalManager
  ) {
    throw new Error("[app-init] missing required dependency");
  }

  // 1) Базовые визуальные оптимизации
  applyPerformanceProfile();

  // 2) SVG-кольца должны быть в DOM до инициализации таймеров
  initRingSvg();

  // 3) Динамическая подстройка размера кольца и центрирование GO
  initDynamicRingAndGoLayout();

  // 4) Системные менеджеры
  langManager.init();
  initTouchRanges();
  themeManager.init();

  // 5) Ядро фич
  sm.init();
  sw.init();
  tm.init();
  tb.init();

  // 6) Навигация
  navigation.init();

  // 7) Модалки
  const modalConfig = createModalConfig({ sw, tb });
  modalManager.init(modalConfig);
}
