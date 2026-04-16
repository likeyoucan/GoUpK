// Файл: js/main.js

import { $, showToast, safeRemoveLS, requestWakeLock, releaseWakeLock } from "./utils.js?v=VERSION";
import { langManager, t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { store } from "./store.js?v=VERSION"; // [РЕФАКТОРИНГ] Импортируем наш новый store

/**
 * Динамически вставляет SVG-кольца прогресса в контейнеры с атрибутом [data-ring].
 * Это позволяет избежать дублирования SVG-кода в HTML.
 */
function injectSVG() {
  const svgs = {
    sw: "sw-progressRing",
    tm: "tm-progressRing",
    tb: "tb-progressRing"
  };
  document.querySelectorAll("[data-ring]").forEach((container) => {
    const type = container.getAttribute("data-ring");
    const ringId = svgs[type];
    if (!ringId || container.querySelector("svg")) return;
    const pointerEventsClass = type === "tm" ? "pointer-events-none" : "";
    const svgHTML = `
      <svg focusable="false" class="w-full h-full transform ${pointerEventsClass}" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="app-text opacity-10" stroke-width="var(--ring-stroke-width, 4)" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
        <circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="var(--ring-stroke-width, 4)" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" />
      </svg>`;
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}

/**
 * Конфигурация для всех модальных окон в приложении.
 * Используется модулем ModalManager для их инициализации.
 */
const modalConfig = [
  { id: 'sw-sessions-modal', type: 'bottom-sheet', handlerId: 'sw-modal-handler', onOpen: () => sw.sortSessions(sw.currentSort) },
  { id: 'tb-modal', type: 'bottom-sheet', handlerId: 'tb-modal-handler', onOpen: (data) => tb.prepareEdit(data.idToEdit), onClose: () => tb.editingWorkoutId = null },
  { id: 'reset-modal', type: 'alert', contentId: 'reset-modal-content' },
  { id: 'sw-clear-modal', type: 'alert', contentId: 'sw-clear-modal-content' },
  { id: 'sw-name-modal', type: 'alert', contentId: 'sw-name-modal-content', onOpen: (data) => sw.prepareNameForm(data) },
];

/**
 * [РЕФАКТОРИНГ] Функция для подтверждения сброса всех настроек приложения.
 * Теперь она вызывает методы сброса в каждом модуле, вместо того чтобы хранить список ключей.
 * Это делает код более модульным и надежным.
 */
function confirmReset() {
    modalManager.closeCurrent();
    
    // Вызываем сброс в каждом ответственном модуле
    themeManager.resetSettings(); // Предполагается, что вы добавили этот метод в theme.js
    sm.resetSettings();         // Предполагается, что вы добавили этот метод в sound.js
    langManager.resetSettings();    // Предполагается, что вы добавили этот метод в i18n.js

    setTimeout(() => showToast(t("settings_reset_success")), 450);
}


/**
 * Основная точка входа в приложение.
 * Запускается после полной загрузки DOM.
 */
document.addEventListener("DOMContentLoaded", () => {
  injectSVG();

  // 1. Сначала инициализируем все модули, от которых могут зависеть другие.
  langManager.init();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();
  
  // 2. Затем инициализируем менеджер модальных окон, передавая ему конфигурацию.
  modalManager.init(modalConfig);

  // Убираем класс 'preload' для включения анимаций после загрузки.
  setTimeout(() => document.body.classList.remove("preload"), 50);

  // --- Назначение обработчиков событий для элементов UI ---

  // Обработчики открытия модальных окон
  $("sw-openResultsBtn")?.addEventListener("click", () => modalManager.open('sw-sessions-modal'));
  $("tb-openModalBtn")?.addEventListener("click", () => modalManager.open('tb-modal', { idToEdit: null }));
  $("btn-open-reset")?.addEventListener("click", () => modalManager.open('reset-modal'));
  $("sw-clearAllBtn")?.addEventListener("click", () => {
    if (sw.savedSessions.length > 0) modalManager.open('sw-clear-modal');
  });

  // Обработчики подтверждения действий в модальных окнах
  $("reset-confirm")?.addEventListener("click", confirmReset);
  $("sw-clear-confirm")?.addEventListener("click", () => sw.confirmClearAll());
  $("sw-name-modal-content")?.addEventListener("submit", (e) => {
    e.preventDefault();
    sw.confirmNameModal();
  });
  $("tb-modal-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    tb.saveWorkout();
  });

  // Глобальный обработчик для кнопок навигации
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => navigation.switchView(e.currentTarget.getAttribute("data-nav")));
  });

  // Глобальный обработчик для горячих клавиш (Space, L, R)
  document.addEventListener("keydown", (e) => {
    if (modalManager.hasActiveModal() || e.target.closest('input, textarea, select, button, [contenteditable="true"]')) {
      return; // Игнорируем, если открыто модальное окно или фокус на элементе ввода
    }
    const view = navigation.activeView;
    if (e.code === "Space") {
      e.preventDefault();
      if (view === "stopwatch") sw.toggle();
      else if (view === "timer") tm.toggle();
      else if (view === "tabata") tb.toggle();
    } else if (e.key.toLowerCase() === "l" && view === "stopwatch") {
      sw.recordLapOrReset();
    } else if (e.key.toLowerCase() === "r") {
      if (view === "timer") tm.reset(true);
      else if (view === "tabata") tb.stop();
    }
  });

  // Обработчик двойного касания на экране секундомера для записи круга
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

  // --- Логика свайп-навигации между вкладками ---
  const appContainer = $("app");
  const swipeAreaLeft = $("swipe-area-left");
  const swipeAreaRight = $("swipe-area-right");
  const tabs = ["stopwatch", "timer", "tabata", "settings"];
  let touchStartX = 0, touchStartY = 0, isSwipeActive = false;

  appContainer.addEventListener("touchstart", (e) => {
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
  }, { passive: true });

  appContainer.addEventListener("touchend", (e) => {
    if (!isSwipeActive) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 100) {
      const currentIdx = tabs.indexOf(navigation.activeView);
      if (deltaX < 0 && currentIdx < tabs.length - 1) {
        navigation.switchView(tabs[currentIdx + 1]);
      } else if (deltaX > 0 && currentIdx > 0) {
        navigation.switchView(tabs[currentIdx - 1]);
      }
    }
    isSwipeActive = false;
    touchStartX = 0;
    appContainer.classList.remove("is-swiping");
  }, { passive: true });

  appContainer.addEventListener("touchcancel", () => {
    if (isSwipeActive) {
      isSwipeActive = false;
      touchStartX = 0;
      appContainer.classList.remove("is-swiping");
    }
  }, { passive: true });

  // --- Системная интеграция с Capacitor для нативных платформ (Android/iOS) ---
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    const { StatusBar, App, CapacitorAndroidForegroundService: FgService } = window.Capacitor.Plugins;

    // Управление статус-баром
    if (StatusBar) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: "DARK" }).catch(() => {});
    }

    // Обработка системной кнопки "назад" на Android
    if (App) {
      App.addListener('backButton', () => {
        if (modalManager.hasActiveModal()) {
          modalManager.closeCurrent();
        } else if (navigation.activeView !== 'stopwatch') {
          navigation.switchView('stopwatch');
        } else {
          App.minimizeApp();
        }
      });
    }

    // Управление фоновым сервисом и уведомлениями на Android
    if (App && FgService) {
      let fgInterval = null;

      /**
       * [РЕФАКТОРИНГ] Обновляет уведомление в фоновом режиме.
       * Теперь принимает имя активного таймера и использует switch, а не if/else.
       * @param {string | null} activeTimer 
       */
      async function updateForegroundNotification(activeTimer) {
        let title = "Stopwatch Pro";
        let body = "Running in background";

        switch (activeTimer) {
          case 'stopwatch':
            title = "⏱ Stopwatch";
            body = sw.formatTime(sw.elapsedTime, false);
            break;
           getRemainingTime() {
    if (!this.isRunning && !this.isPaused) return 0;
    return timeRemainingMs;
  },
            // NOTE: Эта логика все еще зависит от внутреннего состояния tm.js.
            // В идеале, tm.js должен предоставлять функцию для получения оставшегося времени.
            const remTm = Math.max(0, tm.targetTime - performance.now());
            body = tm.getFormattedTime(Math.ceil(remTm / 1000));
            break;
          case 'tabata':
            const activeName = $("tb-activeName")?.textContent || "Tabata";
            title = `🏋️ ${activeName}`;
            const remTb = Math.max(0, tb.phaseEndTime - performance.now());
            const sTotal = Math.ceil(remTb / 1000);
            let phaseStr = tb.status === "WORK" ? t("work") : tb.status === "REST" ? t("rest") : t("get_ready");
            body = `${t("round")} ${tb.currentRound}/${tb.rounds} • ${phaseStr}: ${sTotal}s`;
            break;
          default:
            // Этот блок выполнится, если таймер остановился, пока мы были в фоне,
            // или если не было активного таймера.
            if (fgInterval) {
              clearInterval(fgInterval);
              fgInterval = null;
            }
            await FgService.stop().catch(() => {});
            return;
        }

        await FgService.start({
          id: 101,
          title,
          body,
          smallIcon: "ic_stat_name",
        }).catch(() => {});
      }

      App.addListener("appStateChange", async ({ isActive }) => {
        // [РЕФАКТОРИНГ] Используем store для определения, активен ли какой-либо таймер.
        const activeTimer = store.getActiveTimer();
        const isTimerRunning = !!activeTimer;

        if (!isActive && isTimerRunning) {
          sm.unlock();
          requestWakeLock();
          // Передаем имя активного таймера в функцию уведомлений
          await updateForegroundNotification(activeTimer); 
          if (!fgInterval) {
            // И здесь тоже
            fgInterval = setInterval(() => updateForegroundNotification(store.getActiveTimer()), 1000);
          }
        } else if (isActive) {
          if (fgInterval) {
            clearInterval(fgInterval);
            fgInterval = null;
          }
          await FgService.stop().catch(() => {});
          releaseWakeLock();
        }
      });
    }
  }
});