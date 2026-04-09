// ===== main.js (ФИНАЛЬНАЯ ВЕРСИЯ) =====

import { $, showToast, requestWakeLock } from "./utils.js";
import { langManager, t } from "./i18n.js";
import { themeManager } from "./theme.js";
import { navigation } from "./navigation.js";
import { sw } from "./stopwatch.js";
import { tm } from "./timer.js";
import { tb } from "./tabata.js";
import { sm } from "./sound.js";

// === ДИНАМИЧЕСКИЙ РЕНДЕР SVG КОЛЕЦ ===
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
    const pointerEventsClass = type === "tm" ? "pointer-events-none" : "";
    const svgHTML = `<svg focusable="false" class="w-full h-full transform ${pointerEventsClass}" viewBox="0 0 100 100" aria-hidden="true"><circle class="app-text opacity-10" stroke-width="4" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" /><circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="4" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" /></svg>`;
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}

// === МОДАЛЬНЫЕ ОКНА И СВАЙПЫ ===
const resetModal = {
  modal: $("reset-modal"),
  content: $("reset-modal-content"),
  open() { this.modal.classList.remove("hidden"); this.modal.classList.add("flex"); this.modal.removeAttribute("inert"); this.modal.removeAttribute("aria-hidden"); requestAnimationFrame(() => { this.modal.classList.remove("opacity-0"); this.content.classList.remove("opacity-0", "scale-95"); }); },
  close() { this.modal.classList.add("opacity-0"); this.content.classList.add("opacity-0", "scale-95"); setTimeout(() => { this.modal.classList.add("hidden"); this.modal.classList.remove("flex"); this.modal.setAttribute("inert", ""); this.modal.setAttribute("aria-hidden", "true"); }, 400); },
  confirm() {
    const keys = ["app_lang", "app_sound", "app_vibro", "app_vibro_level", "app_sound_theme", "app_show_ms", "theme_mode", "theme_color", "theme_bg_color", "font_size", "app_adaptive_bg", "app_vignette", "app_vignette_alpha", "app_liquid_glass"];
    keys.forEach((key) => localStorage.removeItem(key));
    this.close();
    themeManager.applySettings();
    langManager.init();
    sm.applySettings();
    setTimeout(() => showToast(t("settings_reset_success")), 450);
  },
};

function handleCloseActions() {
  if (!$("reset-modal")?.classList.contains("hidden")) { resetModal.close(); return true; }
  if (!$("sw-clear-modal")?.classList.contains("hidden")) { sw.closeClearModal(); return true; }
  if (!$("sw-name-modal")?.classList.contains("hidden")) { sw.closeNameModal(); return true; }
  if (!$("tb-modal")?.classList.contains("hidden")) { tb.closeModal(); return true; }
  if (!$("sw-sessions-modal")?.classList.contains("hidden")) { sw.closeModal(); return true; }
  return false;
}

function initSwipeToClose() {
  const modals = [
    { id: "sw-sessions-modal", closeFn: () => sw.closeModal() },
    { id: "tb-modal", closeFn: () => tb.closeModal() },
  ];
  modals.forEach(({ id, closeFn }) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    // Используем data-атрибут для надежности. Добавьте `data-swipe-handle` в HTML для серой полоски.
    const handle = modal.querySelector("[data-swipe-handle]");
    const touchArea = handle || modal;
    let startY = 0, currentY = 0, isDragging = false;
    touchArea.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; isDragging = true; modal.style.transition = "none"; }, { passive: true });
    touchArea.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      if (deltaY > 0) modal.style.transform = `translateY(${deltaY}px)`;
    }, { passive: false });
    touchArea.addEventListener("touchend", () => {
      if (!isDragging) return;
      isDragging = false;
      modal.style.transition = "transform 400ms ease-out";
      const deltaY = currentY - startY;
      if (deltaY > 100) closeFn();
      else modal.style.transform = "translateY(0)";
      setTimeout(() => (modal.style.transform = ""), 400);
    });
  });
}

// === ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===
document.addEventListener("DOMContentLoaded", () => {
  injectSVG();
  langManager.init();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();
  initSwipeToClose();

  setTimeout(() => document.body.classList.remove("preload"), 50);

  document.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", (e) => navigation.switchView(e.currentTarget.getAttribute("data-nav"))));
  $("btn-open-reset")?.addEventListener("click", () => resetModal.open());
  $("reset-cancel")?.addEventListener("click", () => resetModal.close());
  $("reset-confirm")?.addEventListener("click", () => resetModal.confirm());
  $("sw-name-modal-content")?.addEventListener("submit", (e) => { e.preventDefault(); sw.confirmNameModal(); });
  $("tb-modal-form")?.addEventListener("submit", (e) => { e.preventDefault(); tb.saveWorkout(); });

  // Глобальные обработчики событий (клавиши, жесты)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { handleCloseActions(); return; }
    if (e.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    const view = navigation.activeView;
    if (e.code === "Space") { e.preventDefault(); if (view === "stopwatch") sw.toggle(); else if (view === "timer") tm.toggle(); else if (view === "tabata") tb.toggle(); }
    else if (e.key.toLowerCase() === "l" && view === "stopwatch") { sw.recordLapOrReset(); }
    else if (e.key.toLowerCase() === "r") { if (view === "timer") tm.reset(true); else if (view === "tabata") tb.stop(); }
  });

  let lastBgTap = 0;
  $("view-stopwatch")?.addEventListener("touchstart", (e) => {
    if (e.target.closest("button, .scroll-lock, .selectable-data")) return;
    const now = Date.now();
    if (now - lastBgTap < 300 && sw.isRunning) { e.preventDefault(); sw.recordLapOrReset(); }
    lastBgTap = now;
  });

  let touchStartX = 0, touchStartY = 0;
  const tabs = Array.from(document.querySelectorAll("[data-nav]")).map((btn) => btn.dataset.nav);
  document.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (e.target.closest(".scroll-lock, .no-scrollbar, input, button, select")) return;
    const touchEndX = e.changedTouches[0].clientX, touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX, deltaY = touchEndY - touchStartY;
    if (Math.abs(deltaX) > 80 && Math.abs(deltaY) < 50) {
      const currentIdx = tabs.indexOf(navigation.activeView);
      if (deltaX < 0 && currentIdx < tabs.length - 1) { navigation.switchView(tabs[currentIdx + 1]); }
      else if (deltaX > 0 && currentIdx > 0) { navigation.switchView(tabs[currentIdx - 1]); }
    }
  });

  // === СИСТЕМНАЯ ИНТЕГРАЦИЯ ANDROID ===
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    const { App, StatusBar, AndroidForegroundService } = window.Capacitor.Plugins;
    if (StatusBar) StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    if (App) App.addListener("backButton", () => { if (handleCloseActions()) return; if (navigation.activeView !== "stopwatch") navigation.switchView("stopwatch"); else App.minimizeApp(); });
    if (App && AndroidForegroundService) {
      let fgInterval = null;
      async function updateForegroundNotification() {
        let title = "Stopwatch Pro", body = "Работает в фоне";
        if (sw.isRunning) { title = `⏱ ${t('stopwatch')}`; body = `${t('time')}: ${sw.formatTime(sw.elapsedTime, false)}`; }
        else if (tm.isRunning) { title = `⏳ ${t('timer')}`; const rem = Math.max(0, tm.targetTime - performance.now()); body = `${t('remaining')}: ${tm.getFormattedTime(Math.ceil(rem / 1000))}`; }
        else if (tb.status !== "STOPPED" && !tb.paused) { title = `🏋️ ${t('tabata')}: ${document.getElementById("tb-activeName").textContent}`; const rem = Math.max(0, tb.phaseEndTime - performance.now()); const sTotal = Math.ceil(rem / 1000); let phaseStr = t('get_ready'); if (tb.status === "WORK") phaseStr = t('work'); else if (tb.status === "REST") phaseStr = t('rest'); body = `${t('round')} ${tb.currentRound}/${tb.rounds} | ${phaseStr}: ${sTotal} ${t('sec').toLowerCase()}`; }
        else { if (fgInterval) clearInterval(fgInterval); await AndroidForegroundService.stop(); return; }
        await AndroidForegroundService.start({ id: 101, title, body, smallIcon: "ic_stat_name" }).catch(() => {});
      }
      App.addListener("appStateChange", async ({ isActive }) => {
        const isTimerRunning = sw.isRunning || tm.isRunning || (tb.status !== "STOPPED" && !tb.paused);
        if (!isActive && isTimerRunning) { sm.unlock(); requestWakeLock(); updateForegroundNotification(); fgInterval = setInterval(updateForegroundNotification, 1000); }
        else { if (fgInterval) { clearInterval(fgInterval); fgInterval = null; } await AndroidForegroundService.stop().catch(() => {}); }
      });
    }
  }
});