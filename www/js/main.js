/*! main.js */

import { $, showToast, safeRemoveLS, requestWakeLock } from "./utils.js";
import { langManager, t } from "./i18n.js";
import { themeManager } from "./theme.js";
import { navigation } from "./navigation.js";
import { sw } from "./stopwatch.js";
import { tm } from "./timer.js";
import { tb } from "./tabata.js";
import { sm } from "./sound.js";

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
    container.insertAdjacentHTML(
      "afterbegin",
      `
      <svg focusable="false" class="w-full h-full transform ${pointerEventsClass}" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="app-text opacity-10" stroke-width="4" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
        <circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="4" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" />
      </svg>
    `,
    );
  });
}

const resetModal = {
  modal: null,
  content: null,

  init() {
    this.modal = $("reset-modal");
    this.content = $("reset-modal-content");
  },

  open() {
    if (!this.modal) return;
    this.modal.classList.replace("hidden", "flex");
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
      this.modal.classList.replace("flex", "hidden");
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
    keys.forEach(safeRemoveLS);
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

    const touchArea =
      modal.querySelector(".w-12.h-1\\.5")?.parentElement || modal;
    let startY = 0,
      currentY = 0,
      isDragging = false;

    touchArea.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches[0].clientY;
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
        if (deltaY > 0) modal.style.transform = `translateY(${deltaY}px)`;
      },
      { passive: true },
    );

    touchArea.addEventListener("touchend", () => {
      if (!isDragging) return;
      isDragging = false;
      modal.style.transition = "transform 400ms ease-out";
      if (currentY - startY > 100) closeFn();
      else modal.style.transform = "translateY(0)";
      setTimeout(() => {
        modal.style.transform = "";
        modal.style.transition = "";
      }, 400);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  [
    injectSVG,
    resetModal.init,
    langManager.init,
    themeManager.init,
    sm.init,
    sw.init,
    tm.init,
    tb.init,
    navigation.init,
    initSwipeToClose,
  ].forEach((fn) => fn.call(resetModal));

  setTimeout(() => document.body.classList.remove("preload"), 50);

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      navigation.switchView(e.currentTarget.getAttribute("data-nav")),
    );
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
      if (!$("sw-name-modal")?.classList.contains("hidden"))
        return sw.closeNameModal();
      if (!$("sw-clear-modal")?.classList.contains("hidden"))
        return sw.closeClearModal();
      if (!$("sw-sessions-modal")?.classList.contains("hidden"))
        return sw.closeModal();
      if (!$("tb-modal")?.classList.contains("hidden")) return tb.closeModal();
      if (!$("reset-modal")?.classList.contains("hidden"))
        return resetModal.close();
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

  let touchStartX = 0,
    touchStartY = 0;
  const tabs = ["stopwatch", "timer", "tabata", "settings"];

  document.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener("touchend", (e) => {
    if (e.target.closest(".scroll-lock, .no-scrollbar, input, button, select"))
      return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(deltaX) > 80 && Math.abs(deltaY) < 50) {
      const currentIdx = tabs.indexOf(navigation.activeView);
      if (deltaX < 0 && currentIdx < tabs.length - 1)
        navigation.switchView(tabs[currentIdx + 1]);
      else if (deltaX > 0 && currentIdx > 0)
        navigation.switchView(tabs[currentIdx - 1]);
    }
  });

  if (window.Capacitor?.isNativePlatform()) {
    const P = window.Capacitor.Plugins;
    P.StatusBar?.setOverlaysWebView({ overlay: true }).catch(() => {});
    P.StatusBar?.setStyle({ style: "DARK" }).catch(() => {});

    P.App?.addListener("backButton", () => {
      if (!$("sw-name-modal")?.classList.contains("hidden"))
        return sw.closeNameModal();
      if (!$("sw-clear-modal")?.classList.contains("hidden"))
        return sw.closeClearModal();
      if (!$("sw-sessions-modal")?.classList.contains("hidden"))
        return sw.closeModal();
      if (!$("tb-modal")?.classList.contains("hidden")) return tb.closeModal();
      if (!$("reset-modal")?.classList.contains("hidden"))
        return resetModal.close();
      if (navigation.activeView !== "stopwatch")
        return navigation.switchView("stopwatch");
      P.App.minimizeApp();
    });

    const Fg =
      P.CapacitorAndroidForegroundService || P.AndroidForegroundService;
    if (P.App && Fg) {
      let fgInterval = null;
      const updateFg = async () => {
        let t = "Stopwatch Pro",
          b = "Running";
        if (sw.isRunning) {
          t = "⏱ Stopwatch";
          b = sw.formatTime(sw.elapsedTime, false);
        } else if (tm.isRunning) {
          t = "⏳ Timer";
          b = tm.getFormattedTime(
            Math.ceil((tm.targetTime - performance.now()) / 1000),
          );
        } else if (tb.status !== "STOPPED" && !tb.paused) {
          t = `🏋️ ${$("tb-activeName")?.textContent || "Tabata"}`;
          b = `Round ${tb.currentRound}/${tb.rounds}`;
        } else {
          clearInterval(fgInterval);
          fgInterval = null;
          return Fg.stop();
        }
        Fg.start({ id: 101, title: t, body: b, smallIcon: "ic_stat_name" });
      };

      P.App.addListener("appStateChange", ({ isActive }) => {
        if (
          !isActive &&
          (sw.isRunning ||
            tm.isRunning ||
            (tb.status !== "STOPPED" && !tb.paused))
        ) {
          sm.unlock();
          requestWakeLock();
          updateFg();
          if (!fgInterval) fgInterval = setInterval(updateFg, 1000);
        } else if (isActive) {
          clearInterval(fgInterval);
          fgInterval = null;
          Fg.stop();
        }
      });
    }
  }
});
