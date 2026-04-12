// main.js

import { $, showToast, safeRemoveLS, requestWakeLock } from "./utils.js?v=VERSION";
import { langManager, t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

// =========================================
// 1. ДИНАМИЧЕСКИЙ РЕНДЕР SVG КОЛЕЦ (DRY)
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
    if (!ringId) return;
    if (container.querySelector("svg")) return;
    const pointerEventsClass = type === "tm" ? "pointer-events-none" : "";
    const svgHTML = `
      <svg focusable="false" class="w-full h-full transform ${pointerEventsClass}" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="app-text opacity-10" stroke-width="4" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
        <circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="4" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" />
      </svg>
    `;
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}

// =========================================
// 2. МОДАЛЬНЫЕ ОКНА И СВАЙПЫ (ЖЕСТЫ)
// =========================================
const resetModal = {
  modal: null,
  content: null,
  init() {
    this.modal = $("reset-modal");
    this.content = $("reset-modal-content");
  },
  open() {
    if (!this.modal) return;
    this.modal.classList.remove("hidden");
    this.modal.classList.add("flex");
    this.modal.removeAttribute("inert");
    this.modal.removeAttribute("aria-hidden");
    requestAnimationFrame(() => {
      this.modal.classList.remove("opacity-0");
      this.content.classList.remove("opacity-0", "scale-95");
    });
  },
  close() {
    if (!this.modal) return;
    this.modal.classList.add("opacity-0");
    this.content.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      this.modal.classList.add("hidden");
      this.modal.classList.remove("flex");
      this.modal.setAttribute("inert", "");
      this.modal.setAttribute("aria-hidden", "true");
    }, 300);
  },
  confirm() {
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
    ];
    keys.forEach((key) => safeRemoveLS(key));
    this.close();
    themeManager.applySettings();
    langManager.init();
    sm.applySettings();
    setTimeout(() => showToast(t("settings_reset_success")), 450);
  },
};
function initSwipeToClose() {
  const modals = [
    { id: "sw-sessions-modal", closeFn: () => sw.closeModal() },
    { id: "tb-modal", closeFn: () => tb.closeModal() },
  ];
  modals.forEach(({ id, closeFn }) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    const handle = modal.querySelector(".w-12.h-1\\.5");
    const touchArea = handle ? handle.parentElement : modal;
    if (!touchArea) return;
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    touchArea.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches[0].clientY;
        currentY = startY;
        isDragging = true;
        modal.style.transition = "none";
      },
      { passive: true },
    );
    touchArea.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;
        if (deltaY > 0) {
          modal.style.transform = `translateY(${deltaY}px)`;
        }
      },
      { passive: true },
    );
    touchArea.addEventListener("touchend", () => {
      if (!isDragging) return;
      isDragging = false;
      modal.style.transition = "transform 400ms ease-out";
      const deltaY = currentY - startY;
      if (deltaY > 100) {
        closeFn();
      } else {
        modal.style.transform = "translateY(0)";
      }
      setTimeout(() => {
        modal.style.transform = "";
        modal.style.transition = "";
      }, 400);
    });
  });
}

// =========================================
// 3. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  injectSVG();
  resetModal.init();
  langManager.init();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();
  initSwipeToClose();
  setTimeout(() => document.body.classList.remove("preload"), 50);

  const tabs = ["stopwatch", "timer", "tabata", "settings"];

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const nextViewId = e.currentTarget.getAttribute("data-nav");
      const currentIdx = tabs.indexOf(navigation.activeView);
      const nextIdx = tabs.indexOf(nextViewId);
      const direction = nextIdx > currentIdx ? 'forward' : 'backward';
      navigation.switchView(nextViewId, direction);
    });
  });

  $("btn-open-reset")?.addEventListener("click", () => resetModal.open());
  $("reset-cancel")?.addEventListener("click", () => resetModal.close());
  $("reset-confirm")?.addEventListener("click", () => resetModal.confirm());
  $("sw-name-modal-content")?.addEventListener("submit", (e) => {
    e.preventDefault();
    sw.confirmNameModal();
  });
  $("tb-modal-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    tb.saveWorkout();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("sw-name-modal")?.classList.contains("hidden")) {
        sw.closeNameModal();
        return;
      }
      if (!$("sw-clear-modal")?.classList.contains("hidden")) {
        sw.closeClearModal();
        return;
      }
      if (!$("sw-sessions-modal")?.classList.contains("hidden")) {
        sw.closeModal();
        return;
      }
      if (!$("tb-modal")?.classList.contains("hidden")) {
        tb.closeModal();
        return;
      }
      if (!$("reset-modal")?.classList.contains("hidden")) {
        resetModal.close();
        return;
      }
      return;
    }
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

  // --- ИСПРАВЛЕНИЕ СВАЙПОВ ---
  const viewsContainer = $("viewsContainer");
  if (viewsContainer) {
    let touchStartX = 0;
    let touchStartY = 0;

    viewsContainer.addEventListener(
      "touchstart",
      (e) => {
        // Не начинаем свайп, если касание на интерактивном элементе
        if (e.target.closest("button, a, input, select, .scroll-lock, .no-scrollbar")) {
          touchStartX = 0; // Сбрасываем, чтобы touchend не сработал
          return;
        }
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true },
    );

    viewsContainer.addEventListener("touchend", (e) => {
      // Если свайп не был начат (например, из-за касания на кнопке), выходим
      if (touchStartX === 0) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // Сбрасываем стартовую позицию для следующего свайпа
      touchStartX = 0;

      // Условие: горизонтальное движение должно быть значительным И как минимум в 2 раза больше вертикального
      if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
        const currentIdx = tabs.indexOf(navigation.activeView);
        if (deltaX < 0 && currentIdx < tabs.length - 1) {
          navigation.switchView(tabs[currentIdx + 1], 'forward');
        } else if (deltaX > 0 && currentIdx > 0) {
          navigation.switchView(tabs[currentIdx - 1], 'backward');
        }
      }
    });
  }


  // =========================================
  // 4. СИСТЕМНАЯ ИНТЕГРАЦИЯ ANDROID
  // =========================================
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    const Plugins = window.Capacitor.Plugins;
    if (Plugins.StatusBar) {
      Plugins.StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      Plugins.StatusBar.setStyle({ style: "DARK" }).catch(() => {});
    }
    if (Plugins.App) {
      Plugins.App.addListener("backButton", () => {
        if (!$("sw-name-modal")?.classList.contains("hidden")) {
          sw.closeNameModal();
          return;
        }
        if (!$("sw-clear-modal")?.classList.contains("hidden")) {
          sw.closeClearModal();
          return;
        }
        if (!$("sw-sessions-modal")?.classList.contains("hidden")) {
          sw.closeModal();
          return;
        }
        if (!$("tb-modal")?.classList.contains("hidden")) {
          tb.closeModal();
          return;
        }
        if (!$("reset-modal")?.classList.contains("hidden")) {
          resetModal.close();
          return;
        }
        if (navigation.activeView !== "stopwatch") {
          navigation.switchView("stopwatch");
          return;
        }
        Plugins.App.minimizeApp().catch(() => {});
      });
    }
    const FgService =
      Plugins.CapacitorAndroidForegroundService ||
      Plugins.AndroidForegroundService;
    if (Plugins.App && FgService) {
      let fgInterval = null;
      async function updateForegroundNotification() {
        let title = "Stopwatch Pro";
        let body = "Running in background";
        if (sw.isRunning) {
          title = "⏱ Stopwatch";
          body = sw.formatTime(sw.elapsedTime, false);
        } else if (tm.isRunning) {
          title = "⏳ Timer";
          const rem = Math.max(0, tm.targetTime - performance.now());
          body = tm.getFormattedTime(Math.ceil(rem / 1000));
        } else if (tb.status !== "STOPPED" && !tb.paused) {
          const activeName = $("tb-activeName")?.textContent || "Tabata";
          title = `🏋️ ${activeName}`;
          const rem = Math.max(0, tb.phaseEndTime - performance.now());
          const sTotal = Math.ceil(rem / 1000);
          let phaseStr =
            tb.status === "WORK"
              ? "Work"
              : tb.status === "REST"
                ? "Rest"
                : "Get Ready";
          body = `Round ${tb.currentRound}/${tb.rounds} • ${phaseStr}: ${sTotal}s`;
        } else {
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
      Plugins.App.addListener("appStateChange", async ({ isActive }) => {
        const isTimerRunning =
          sw.isRunning ||
          tm.isRunning ||
          (tb.status !== "STOPPED" && !tb.paused);
        if (!isActive && isTimerRunning) {
          sm.unlock();
          requestWakeLock();
          await updateForegroundNotification();
          if (!fgInterval) {
            fgInterval = setInterval(updateForegroundNotification, 1000);
          }
        } else if (isActive) {
          if (fgInterval) {
            clearInterval(fgInterval);
            fgInterval = null;
          }
          await FgService.stop().catch(() => {});
        }
      });
    }
  }
});