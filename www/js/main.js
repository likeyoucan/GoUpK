// // Файл: www/js/main.js

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
        <circle class="app-text opacity-10 transition-all duration-300 group-focus-visible:primary-text group-focus-visible:opacity-30" stroke-width="var(--ring-stroke-width, 4)" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
        <circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="var(--ring-stroke-width, 4)" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" />
      </svg>`;
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}

const modalConfig = [
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
    onClose: () => {
      tb.editingWorkoutId = null;
    },
  },
  { id: "reset-modal", type: "alert", contentId: "reset-modal-content" },
  { id: "sw-clear-modal", type: "alert", contentId: "sw-clear-modal-content" },
  {
    id: "sw-name-modal",
    type: "alert",
    contentId: "sw-name-modal-content",
    onOpen: (data) => sw.prepareNameForm(data),
  },
  {
    id: "sw-share-mode-modal",
    type: "alert",
    contentId: "sw-share-mode-content",
    onClose: () => {
      sw.pendingShareSession = null;
    },
  },
];

function confirmReset() {
  modalManager.closeCurrent();
  themeManager.resetSettings();
  sm.resetSettings();
  langManager.resetSettings();
  setTimeout(() => showToast(t("settings_reset_success")), 450);
}

function isInteractiveElement(target) {
  if (!(target instanceof HTMLElement)) return false;

  if (
    target.closest('input, textarea, select, button, [contenteditable="true"]')
  ) {
    return true;
  }

  if (
    target.closest(
      '[role="button"], [role="option"], [role="listbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="switch"]',
    ) ||
    target.closest(
      '[tabindex="0"][data-interactive], .custom-select-trigger, .custom-select-option',
    )
  ) {
    return true;
  }

  return false;
}

function setupPreloadHide() {
  let hidden = false;

  const hideOnce = () => {
    if (hidden) return;
    hidden = true;
    preload.hide();
  };

  window.addEventListener(
    "load",
    () => {
      requestAnimationFrame(() => hideOnce());
    },
    { once: true },
  );

  setTimeout(() => {
    requestAnimationFrame(() => hideOnce());
  }, 2500);
}

document.addEventListener("DOMContentLoaded", () => {
  preload.show();

  injectSVG();
  langManager.init();
  initTouchRanges();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();
  modalManager.init(modalConfig);

  initForegroundService();
  window.addEventListener("beforeunload", () => {
    destroyForegroundService();
  });

  setupPreloadHide();

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

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      sm.vibrate(20, "light");
      navigation.switchView(e.currentTarget.getAttribute("data-nav"));
    });
  });

  document.addEventListener("keydown", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;

    if (modalManager.hasActiveModal() || isInteractiveElement(target)) return;

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
  $("view-stopwatch")?.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.closest("button, .scroll-lock, .selectable-data")) return;
      const now = Date.now();
      if (now - lastBgTap < 300 && sw.isRunning) {
        e.preventDefault();
        sw.recordLapOrReset();
      }
      lastBgTap = now;
    },
    { passive: false },
  );

  const appContainer = $("app");
  const bottomNav = appContainer?.querySelector("nav");

  if (!appContainer || !bottomNav) {
    console.warn(
      "[main] Swipe elements not found in DOM (#app, nav). Swipe navigation disabled.",
    );
  } else {
    const tabs = ["stopwatch", "timer", "tabata", "settings"];
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwipeCandidate = false;
    let isSwipeActive = false;

    const isInsideNavArea = (touch) => {
      const navRect = bottomNav.getBoundingClientRect();
      return touch.clientY >= navRect.top && touch.clientY <= navRect.bottom;
    };

    appContainer.addEventListener(
      "touchstart",
      (e) => {
        if (modalManager.hasActiveModal()) return;

        const touch = e.touches[0];
        if (!touch || !isInsideNavArea(touch)) return;

        isSwipeCandidate = true;
        isSwipeActive = false;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      },
      { passive: true },
    );

    appContainer.addEventListener(
      "touchmove",
      (e) => {
        if (!isSwipeCandidate) return;

        const touch = e.touches[0];
        if (!touch) return;

        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;

        // Активируем перехват только при выраженном горизонтальном жесте.
        if (!isSwipeActive && Math.abs(deltaX) > 14 && Math.abs(deltaY) < 26) {
          isSwipeActive = true;
          appContainer.classList.add("is-swiping");
          return;
        }

        // Вертикальный жест в меню не должен превращаться в свайп экранов.
        if (!isSwipeActive && Math.abs(deltaY) > 26) {
          isSwipeCandidate = false;
        }
      },
      { passive: true },
    );

    appContainer.addEventListener(
      "touchend",
      (e) => {
        if (!isSwipeCandidate) return;

        if (!isSwipeActive) {
          isSwipeCandidate = false;
          return;
        }

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

        isSwipeCandidate = false;
        isSwipeActive = false;
        touchStartX = 0;
        touchStartY = 0;
        appContainer.classList.remove("is-swiping");
      },
      { passive: true },
    );

    appContainer.addEventListener(
      "touchcancel",
      () => {
        isSwipeCandidate = false;
        isSwipeActive = false;
        touchStartX = 0;
        touchStartY = 0;
        appContainer.classList.remove("is-swiping");
      },
      { passive: true },
    );
  }

  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    const { StatusBar, App } = window.Capacitor.Plugins;

    if (StatusBar) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: "DARK" }).catch(() => {});
    }

    if (App) {
      App.addListener("backButton", () => {
        if (modalManager.hasActiveModal()) {
          modalManager.closeCurrent();
        } else if (navigation.activeView !== "stopwatch") {
          navigation.switchView("stopwatch");
        } else {
          App.minimizeApp();
        }
      });
    }
  }
});
