// www/js/main.js

import {
  $,
  showToast,
  safeRemoveLS,
  requestWakeLock,
} from "./utils.js?v=VERSION";
import { langManager, t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";

// =========================================
// 1. ДИНАМИЧЕСКИЙ РЕНДЕР SVG КОЛЕЦ
// =========================================
function injectSVG() {
  const svgs = {
    sw: "sw-progressRing",
    tm: "tm-progressRing",
    tb: "tb-progressRing",
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
      </svg>
    `;
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}

// =========================================
// 2. КОНФИГУРАЦИЯ МОДАЛЬНЫХ ОКОН
// =========================================
const modalConfig = [
  // Шторки (bottom-sheets)
  {
    id: "sw-sessions-modal",
    type: "bottom-sheet",
    handlerId: "sw-modal-handler",
    onOpen: () => sw.sortSessions(sw.currentSort),
  },
  {
    id: "tb-modal",
    type: "bottom-sheet",
    handlerId: "tb-modal-handler",
    onOpen: (data) => tb.prepareEdit(data.idToEdit),
    onClose: () => (tb.editingWorkoutId = null),
  },
  // Алерт-окна
  {
    id: "reset-modal",
    type: "alert",
    contentId: "reset-modal-content",
    overlayId: "reset-modal",
  },
  {
    id: "sw-clear-modal",
    type: "alert",
    contentId: "sw-clear-modal-content",
    overlayId: "sw-clear-modal",
  },
  {
    id: "sw-name-modal",
    type: "alert",
    contentId: "sw-name-modal-content",
    overlayId: "sw-name-modal",
    onOpen: (data) => sw.prepareNameForm(data),
  },
];

/**
 * Функция сброса настроек приложения.
 */
function confirmReset() {
  const keys = [
    "app_lang",
    "app_sound",
    "app_vibro",
    "app_vibro_level",
    "app_sound_theme",
    "app_show_ms",
    "theme_mode",
    "theme_color",
    "theme_bg_color",
    "font_size",
    "app_adaptive_bg",
    "app_vignette",
    "app_vignette_alpha",
    "app_liquid_glass",
    "app_volume",
    "app_hide_nav_labels",
    "app_ring_width",
  ];
  keys.forEach((key) => safeRemoveLS(key));

  modalManager.closeCurrent();

  themeManager.applySettings();
  langManager.init();
  sm.applySettings();

  setTimeout(() => showToast(t("settings_reset_success")), 450);
}

// =========================================
// 3. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  injectSVG();
  modalManager.init(modalConfig);

  langManager.init();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();

  setTimeout(() => document.body.classList.remove("preload"), 50);

  // --- Обработчики открытия модальных окон ---
  $("sw-openResultsBtn")?.addEventListener("click", () =>
    modalManager.open("sw-sessions-modal"),
  );
  $("tb-openModalBtn")?.addEventListener("click", () =>
    modalManager.open("tb-modal", { idToEdit: null }),
  );
  $("btn-open-reset")?.addEventListener("click", () =>
    modalManager.open("reset-modal"),
  );
  $("sw-clearAllBtn")?.addEventListener("click", () => {
    if (sw.savedSessions.length > 0) modalManager.open("sw-clear-modal");
  });

  // --- Обработчики подтверждения в модальных окнах ---
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

  // --- Глобальные обработчики действий ---
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      navigation.switchView(e.currentTarget.getAttribute("data-nav")),
    );
  });

  document.addEventListener("keydown", (e) => {
    if (modalManager.hasActiveModal()) return; // Не реагируем, если открыта модалка
    if (
      e.target.closest(
        'input, textarea, select, button, [contenteditable="true"]',
      )
    )
      return;

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

  let lastBgTap = 0;
  $("view-stopwatch")?.addEventListener("touchstart", (e) => {
    if (e.target.closest("button, .scroll-lock, .selectable-data")) return;
    const now = Date.now();
    if (now - lastBgTap < 300 && sw.isRunning) {
      e.preventDefault();
      sw.recordLapOrReset();
    }
    lastBgTap = now;
  });

  // --- Логика свайп-навигации ---
  const appContainer = $("app");
  const swipeAreaLeft = $("swipe-area-left");
  const swipeAreaRight = $("swipe-area-right");
  const tabs = ["stopwatch", "timer", "tabata", "settings"];

  let touchStartX = 0;
  let touchStartY = 0;
  let isSwipeActive = false;

  appContainer.addEventListener(
    "touchstart",
    (e) => {
      if (modalManager.hasActiveModal()) return;
      const touch = e.touches[0];
      const x = touch.clientX;
      const leftRect = swipeAreaLeft.getBoundingClientRect();
      const rightRect = swipeAreaRight.getBoundingClientRect();
      const isInLeftArea = x >= leftRect.left && x <= leftRect.right;
      const isInRightArea = x >= rightRect.left && x <= rightRect.right;
      if (isInLeftArea || isInRightArea) {
        isSwipeActive = true;
        touchStartX = x;
        touchStartY = touch.clientY;
        appContainer.classList.add("is-swiping");
      }
    },
    { passive: true },
  );

  appContainer.addEventListener(
    "touchend",
    (e) => {
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
    },
    { passive: true },
  );

  appContainer.addEventListener(
    "touchcancel",
    () => {
      if (!isSwipeActive) return;
      isSwipeActive = false;
      touchStartX = 0;
      appContainer.classList.remove("is-swiping");
    },
    { passive: true },
  );

  // --- Системная интеграция Android ---
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    const {
      StatusBar,
      App,
      CapacitorAndroidForegroundService: FgService,
    } = window.Capacitor.Plugins;

    if (StatusBar) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: "DARK" }).catch(() => {});
    }

    if (App && FgService) {
      let fgInterval = null;
      async function updateForegroundNotification() {
        // ... (логика обновления нотификации без изменений) ...
      }
      App.addListener("appStateChange", async ({ isActive }) => {
        // ... (логика запуска/остановки сервиса без изменений) ...
      });
    }
  }
});
