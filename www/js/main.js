import {
  $,
  showToast,
  requestWakeLock,
  releaseWakeLock,
  formatTime,
} from "./utils.js?v=VERSION";
import { langManager, t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { store } from "./store.js?v=VERSION";
import { initTouchRanges } from "./touch-range.js?v=VERSION";

/**
 * Конфигурация для всех модальных окон в приложении.
 */
const modalConfig = [
  { id: "sw-sessions-modal", type: "bottom-sheet", handlerId: "sw-modal-handler", onOpen: () => sw.sortSessions(sw.currentSort) },
  { id: "tb-modal", type: "bottom-sheet", handlerId: "tb-modal-handler", onOpen: (data) => tb.prepareEdit(data.idToEdit), onClose: () => (tb.editingWorkoutId = null) },
  { id: "reset-modal", type: "alert", contentId: "reset-modal-content" },
  { id: "sw-clear-modal", type: "alert", contentId: "sw-clear-modal-content" },
  { id: "sw-name-modal", type: "alert", contentId: "sw-name-modal-content", onOpen: (data) => sw.prepareNameForm(data) },
];

/**
 * Динамически вставляет SVG-кольца прогресса.
 */
function injectSVGRings() {
  document.querySelectorAll("[data-ring]").forEach((container) => {
    if (container.querySelector("svg")) return;
    const ringId = `${container.getAttribute("data-ring")}-progressRing`;
    const pointerEvents = container.getAttribute("data-ring") === "tm" ? "pointer-events-none" : "";
    const svgHTML = `
      <svg focusable="false" class="w-full h-full transform ${pointerEvents}" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="app-text opacity-10 transition-all duration-300 group-focus-visible:primary-text group-focus-visible:opacity-30" stroke-width="var(--ring-stroke-width, 4)" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
        <circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="var(--ring-stroke-width, 4)" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" />
      </svg>`;
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}

/**
 * Назначает все обработчики событий для UI элементов.
 */
function bindUIHandlers() {
  // Открытие модальных окон
  $("sw-openResultsBtn")?.addEventListener("click", () => modalManager.open("sw-sessions-modal"));
  $("tb-openModalBtn")?.addEventListener("click", () => modalManager.open("tb-modal", { idToEdit: null }));
  $("btn-open-reset")?.addEventListener("click", () => modalManager.open("reset-modal"));
  $("sw-clearAllBtn")?.addEventListener("click", () => {
    if (sw.savedSessions.length > 0) modalManager.open("sw-clear-modal");
  });

  // Подтверждение действий в модальных окнах
  $("reset-confirm")?.addEventListener("click", () => {
    modalManager.closeCurrent();
    themeManager.resetSettings();
    sm.resetSettings();
    langManager.resetSettings();
    setTimeout(() => showToast(t("settings_reset_success")), 450);
  });
  $("sw-clear-confirm")?.addEventListener("click", () => sw.confirmClearAll());
  $("sw-name-modal-content")?.addEventListener("submit", (e) => { e.preventDefault(); sw.confirmNameModal(); });
  $("tb-modal-form")?.addEventListener("submit", (e) => { e.preventDefault(); tb.saveWorkout(); });

  // Навигация
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      sm.vibrate(20, "light");
      navigation.switchView(e.currentTarget.getAttribute("data-nav"));
    });
  });

  // Горячие клавиши
  document.addEventListener("keydown", (e) => {
    if (modalManager.hasActiveModal() || e.target.closest('input, textarea, [contenteditable="true"]')) return;
    
    const view = navigation.activeView;
    const key = e.key.toLowerCase();
    
    if (e.code === "Space") {
      e.preventDefault();
      if (view === "stopwatch") sw.toggle();
      else if (view === "timer") tm.toggle();
      else if (view === "tabata") tb.toggle();
    } else if (key === "l" && view === "stopwatch") {
      sw.recordLapOrReset();
    } else if (key === "r") {
      if (view === "timer") tm.reset(true);
      else if (view === "tabata") tb.stop();
    }
  });
}

/**
 * Назначает обработчики для жестов (свайпы, двойные касания).
 */
function bindGestureHandlers() {
  // Двойное касание для записи круга
  let lastBgTap = 0;
  $("view-stopwatch")?.addEventListener("touchstart", (e) => {
    if (e.target.closest("button, .scroll-lock, .selectable-data")) return;
    const now = Date.now();
    if (now - lastBgTap < 300 && sw.isRunning) {
      e.preventDefault();
      sw.recordLapOrReset();
    }
    lastBgTap = now;
  }, { passive: false });

  // Свайп-навигация между вкладками
  const appContainer = $("app");
  const swipeAreaLeft = $("swipe-area-left");
  const swipeAreaRight = $("swipe-area-right");
  let touchStartX = 0, touchStartY = 0, isSwipeActive = false;

  const onTouchStart = (e) => {
    if (modalManager.hasActiveModal()) return;
    const touch = e.touches[0];
    const x = touch.clientX;
    const leftRect = swipeAreaLeft.getBoundingClientRect();
    const rightRect = swipeAreaRight.getBoundingClientRect();

    if ((x >= leftRect.left && x <= leftRect.right) || (x >= rightRect.left && x <= rightRect.right)) {
      isSwipeActive = true;
      touchStartX = x;
      touchStartY = touch.clientY;
      appContainer.classList.add("is-swiping");
    }
  };

  const onTouchEnd = (e) => {
    if (!isSwipeActive) return;
    isSwipeActive = false;
    appContainer.classList.remove("is-swiping");

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = Math.abs(touch.clientY - touchStartY);

    if (Math.abs(deltaX) > 60 && deltaY < 100) {
      const tabs = navigation.VIEWS; // Используем единый источник истины
      const currentIdx = tabs.indexOf(navigation.activeView);
      if (deltaX < 0 && currentIdx < tabs.length - 1) { // Свайп влево
        navigation.switchView(tabs[currentIdx + 1]);
      } else if (deltaX > 0 && currentIdx > 0) { // Свайп вправо
        navigation.switchView(tabs[currentIdx - 1]);
      }
    }
  };
  
  appContainer.addEventListener("touchstart", onTouchStart, { passive: true });
  appContainer.addEventListener("touchend", onTouchEnd, { passive: true });
  appContainer.addEventListener("touchcancel", () => {
    if (isSwipeActive) {
      isSwipeActive = false;
      appContainer.classList.remove("is-swiping");
    }
  }, { passive: true });
}

/**
 * Настраивает интеграцию с нативной платформой через Capacitor.
 */
function setupNativeIntegration() {
  if (!window.Capacitor?.isNativePlatform()) return;

  const { StatusBar, App, CapacitorAndroidForegroundService: FgService } = window.Capacitor.Plugins;

  // Управление статус-баром
  StatusBar?.setOverlaysWebView({ overlay: true }).catch(() => {});

  // Обработка кнопки "назад" на Android
  App?.addListener("backButton", () => {
    if (modalManager.hasActiveModal()) {
      modalManager.closeCurrent();
    } else if (navigation.activeView !== navigation.VIEWS[0]) {
      navigation.switchView(navigation.VIEWS[0]);
    } else {
      App.minimizeApp();
    }
  });

  // Управление фоновым сервисом на Android
  if (App && FgService) {
    let fgInterval = null;
    
    const updateNotification = async () => {
      const activeTimer = store.getActiveTimer();
      if (!activeTimer) {
        if (fgInterval) clearInterval(fgInterval);
        fgInterval = null;
        await FgService.stop().catch(() => {});
        return;
      }
      
      let title = "Stopwatch Pro", body = "Running...";
      switch (activeTimer) {
        case "stopwatch":
          title = "⏱ Stopwatch";
          body = formatTime(sw.elapsedTime, { showMs: false, forceHours: sw.elapsedTime >= 3600000 });
          break;
        case "timer":
          title = "⏳ Timer";
          body = formatTime(tm.getRemainingTime());
          break;
        case "tabata":
          title = `🏋️ ${$("tb-activeName")?.textContent || "Tabata"}`;
          const remTb = Math.max(0, tb.phaseEndTime - performance.now());
          const phaseStr = t(tb.status.toLowerCase());
          body = `${t("round")} ${tb.currentRound}/${tb.rounds} • ${phaseStr}: ${Math.ceil(remTb / 1000)}s`;
          break;
      }
      await FgService.start({ id: 101, title, body, smallIcon: "ic_stat_name" }).catch(() => {});
    };

    App.addListener("appStateChange", async ({ isActive }) => {
      if (!isActive && store.getActiveTimer()) {
        sm.unlock();
        requestWakeLock();
        await updateNotification();
        if (!fgInterval) {
          fgInterval = setInterval(updateNotification, 1000);
        }
      } else if (isActive) {
        if (fgInterval) clearInterval(fgInterval);
        fgInterval = null;
        await FgService.stop().catch(() => {});
        releaseWakeLock();
      }
    });
  }
}

/**
 * Главная функция инициализации приложения.
 */
function initializeApp() {
  // 1. Подготовка UI
  injectSVGRings();
  
  // 2. Инициализация базовых модулей
  langManager.init();
  themeManager.init(); // Включает в себя colorManager и uiSettingsManager
  sm.init();

  // 3. Инициализация основных модулей приложения
  sw.init();
  tm.init();
  tb.init();

  // 4. Инициализация модулей UI
  navigation.init();
  modalManager.init(modalConfig);
  initTouchRanges();

  // 5. Привязка обработчиков
  bindUIHandlers();
  bindGestureHandlers();

  // 6. Настройка интеграции с нативной платформой
  setupNativeIntegration();
  
  // 7. Убираем 'preload' для включения анимаций
  setTimeout(() => document.body.classList.remove("preload"), 50);
}

// Запуск приложения после полной загрузки DOM
document.addEventListener("DOMContentLoaded", initializeApp);