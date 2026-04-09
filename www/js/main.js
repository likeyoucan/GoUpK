import { $, showToast, safeRemoveLS, requestWakeLock } from "./utils.js";
import { langManager, t } from "./i18n.js";
import { themeManager } from "./theme.js";
import { navigation } from "./navigation.js";
import { sw } from "./stopwatch.js";
import { tm } from "./timer.js";
import { tb } from "./tabata.js";
import { sm } from "./sound.js";

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

    // Таймеру нужен pointer-events-none, чтобы клик проходил насквозь к кнопке,
    // секундомеру и табате — нет.
    const pointerEventsClass = type === "tm" ? "pointer-events-none" : "";

    const svgHTML = `
      <svg focusable="false" class="w-full h-full transform ${pointerEventsClass}" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="app-text opacity-10" stroke-width="4" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
        <circle id="${ringId}" class="progress-ring__circle primary-stroke" stroke-width="4" stroke-linecap="round" fill="transparent" r="45" cx="50" cy="50" />
      </svg>
    `;

    // Вставляем SVG в начало контейнера (перед кнопками управления)
    container.insertAdjacentHTML("afterbegin", svgHTML);
  });
}

// =========================================
// 2. МОДАЛЬНОЕ ОКНО СБРОСА НАСТРОЕК
// =========================================
const resetModal = {
  modal: $("reset-modal"),
  content: $("reset-modal-content"),

  open() {
    this.modal.classList.remove("hidden");
    this.modal.classList.add("flex");
    this.modal.removeAttribute("inert");
    this.modal.removeAttribute("aria-hidden");

    requestAnimationFrame(() => {
      this.modal.classList.remove("opacity-0");
      this.content.classList.remove("opacity-0", "translate-y-16");
    });
  },

  close() {
    this.modal.classList.add("opacity-0");
    this.content.classList.add("opacity-0", "translate-y-16");

    setTimeout(() => {
      this.modal.classList.add("hidden");
      this.modal.classList.remove("flex");
      this.modal.setAttribute("inert", "");
      this.modal.setAttribute("aria-hidden", "true");
    }, 400);
  },

  confirm() {
    // Список ключей настроек в localStorage для удаления
    const settingsKeysToReset = [
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
    ];

    settingsKeysToReset.forEach((key) => safeRemoveLS(key));
    this.close();

    // Применяем стандартные настройки заново
    themeManager.applySettings();
    langManager.init();
    sm.applySettings();

    setTimeout(() => showToast(t("settings_reset_success")), 450);
  },
};

// =========================================
// 3. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Сначала вставляем SVG в DOM, чтобы модули смогли найти их по ID
  injectSVG();

  // 2. Инициализируем модули
  langManager.init();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();

  // 3. Снимаем блокировку CSS-анимаций (защита от скачков при загрузке)
  setTimeout(() => document.body.classList.remove("preload"), 50);

  // 4. Навигация нижнего меню
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const viewId = e.currentTarget.getAttribute("data-nav");
      navigation.switchView(viewId);
    });
  });

  // 5. Обработчики модального окна настроек
  $("btn-open-reset")?.addEventListener("click", () => resetModal.open());
  $("reset-cancel")?.addEventListener("click", () => resetModal.close());
  $("reset-confirm")?.addEventListener("click", () => resetModal.confirm());

  // 6. Обработка форм (сохранение тренировок и сессий)
  $("sw-name-modal-content")?.addEventListener("submit", (e) => {
    e.preventDefault();
    sw.confirmNameModal();
  });
  $("tb-modal-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    tb.saveWorkout();
  });

  // 7. Обработка сворачивания/разворачивания приложения (PWA/Capacitor)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      sm.unlock();

      // Проверяем, работает ли какой-нибудь из таймеров
      const isTimerRunning =
        sw.isRunning || tm.isRunning || (tb.status !== "STOPPED" && !tb.paused);

      // Если да, снова запрашиваем блокировку экрана (чтобы не гас)
      if (isTimerRunning) {
        requestWakeLock();
      }
    }
  });

  // 8. Глобальные горячие клавиши
  document.addEventListener("keydown", (e) => {
    // Закрытие модалок по Escape
    if (e.key === "Escape") {
      if (!$("sw-name-modal")?.classList.contains("hidden"))
        sw.closeNameModal();
      if (!$("sw-clear-modal")?.classList.contains("hidden"))
        sw.closeClearModal();
      if (!$("sw-sessions-modal")?.classList.contains("hidden"))
        sw.closeModal();
      if (!$("tb-modal")?.classList.contains("hidden")) tb.closeModal();
      if (!$("reset-modal")?.classList.contains("hidden")) resetModal.close();
      return;
    }

    // Игнорируем шорткаты, если фокус находится в поле ввода
    if (
      e.target.closest(
        'input, textarea, select, button, [contenteditable="true"]'
      )
    )
      return;

    const view = navigation.activeView;

    // Управление таймерами
    if (e.code === "Space") {
      e.preventDefault(); // Предотвращаем скролл страницы пробелом
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
});
