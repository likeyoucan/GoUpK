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
    ];
    keys.forEach((key) => safeRemoveLS(key));
    this.close();
    themeManager.applySettings();
    langManager.init();
    sm.applySettings();
    setTimeout(() => showToast(t("settings_reset_success")), 450);
  },
};

// Функция Свайпа вниз для закрытия всех шторок (Bottom Sheets)
function initSwipeToClose() {
  const modals = [
    { id: "sw-sessions-modal", closeFn: () => sw.closeModal() },
    { id: "tb-modal", closeFn: () => tb.closeModal() },
  ];

  modals.forEach(({ id, closeFn }) => {
    const modal = document.getElementById(id);
    if (!modal) return;

    // Ищем верхнюю серую полоску (ручку за которую тянуть)
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
        isDragging = true;
        modal.style.transition = "none"; // Отключаем CSS анимацию во время свайпа
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
          // Двигаем только вниз
          modal.style.transform = `translateY(${deltaY}px)`;
        }
      },
      { passive: false },
    );

    touchArea.addEventListener("touchend", () => {
      if (!isDragging) return;
      isDragging = false;
      modal.style.transition = "transform 400ms ease-out"; // Возвращаем анимацию

      const deltaY = currentY - startY;
      if (deltaY > 100) {
        // Если протянули больше 100px - закрываем
        closeFn();
      } else {
        // Иначе отпружиниваем обратно
        modal.style.transform = "translateY(0)";
      }
      setTimeout(() => (modal.style.transform = ""), 400); // Очищаем inline стили
    });
  });
}

// =========================================
// 3. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  injectSVG();
  langManager.init();
  themeManager.init();
  sm.init();
  sw.init();
  tm.init();
  tb.init();
  navigation.init();
  initSwipeToClose(); // Инициализация свайпов

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

  // Глобальные клавиши (Для веб-версии)
  document.addEventListener("keydown", (e) => {
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

  // =========================================
  // ЖЕСТЫ (СВАЙПЫ И ДАБЛ-ТАП)
  // =========================================
  // 1. Двойной тап по фону секундомера для отсечки КРУГА (Lap)
  let lastBgTap = 0;
  $("view-stopwatch")?.addEventListener("touchstart", (e) => {
    // Игнорируем, если нажали на кнопку, список кругов или полоску прокрутки
    if (e.target.closest("button, .scroll-lock, .selectable-data")) return;

    const now = Date.now();
    if (now - lastBgTap < 300 && sw.isRunning) {
      e.preventDefault();
      sw.recordLapOrReset(); // Отсекаем круг!
    }
    lastBgTap = now;
  });

  // 2. Свайпы влево/вправо для переключения между Таймером/Секундомером/Табатой
  let touchStartX = 0;
  let touchStartY = 0;
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
    // Игнорируем свайп, если пользователь крутит настройки или списки
    if (e.target.closest(".scroll-lock, .no-scrollbar, input, button, select"))
      return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Проверяем, что это строгий горизонтальный свайп (без прокрутки вверх-вниз)
    if (Math.abs(deltaX) > 100 && Math.abs(deltaY) < 50) {
      const currentIdx = tabs.indexOf(navigation.activeView);

      if (deltaX < 0 && currentIdx < tabs.length - 1) {
        // Свайп ВЛЕВО -> Следующая вкладка
        document.querySelector(`[data-nav="${tabs[currentIdx + 1]}"]`)?.click();
      } else if (deltaX > 0 && currentIdx > 0) {
        // Свайп ВПРАВО -> Предыдущая вкладка
        document.querySelector(`[data-nav="${tabs[currentIdx - 1]}"]`)?.click();
      }
    }
  });

  // =========================================
  // 4. СИСТЕМНАЯ ИНТЕГРАЦИЯ ANDROID (ПРО-УРОВЕНЬ)
  // =========================================
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    const { App, StatusBar, ForegroundService } = window.Capacitor.Plugins;

    // 1. Прозрачный статус-бар (Безрамочный дизайн)
    if (StatusBar) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: "DARK" }).catch(() => {}); // Делаем иконки белыми
    }

    // 2. Системная кнопка "Назад" / Свайп от края
    if (App) {
      App.addListener("backButton", () => {
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
          const btn = document.querySelector('[data-nav="stopwatch"]');
          if (btn) btn.click();
          return;
        }
        App.minimizeApp(); // Аккуратно сворачиваем, если всё закрыто
      });
    }

    // 3. ЖИВАЯ ФОНОВАЯ СЛУЖБА (FOREGROUND SERVICE)
    if (App && ForegroundService) {
      let fgInterval = null; // Интервал для обновления шторки

      // Функция обновления текста в шторке
      async function updateForegroundNotification() {
        let title = "Stopwatch Pro";
        let body = "Работает в фоне";

        if (sw.isRunning) {
          title = "⏱ Секундомер";
          body = `Время: ${sw.formatTime(sw.elapsedTime, false)}`;
        } else if (tm.isRunning) {
          title = "⏳ Таймер";
          const rem = Math.max(0, tm.targetTime - performance.now());
          body = `Осталось: ${tm.getFormattedTime(Math.ceil(rem / 1000))}`;
        } else if (tb.status !== "STOPPED" && !tb.paused) {
          title = `🏋️ Табата: ${document.getElementById("tb-activeName").textContent}`;
          const rem = Math.max(0, tb.phaseEndTime - performance.now());
          const sTotal = Math.ceil(rem / 1000);

          let phaseStr = "⏳ Подготовка";
          if (tb.status === "WORK") phaseStr = "🔥 Работа";
          else if (tb.status === "REST") phaseStr = "💤 Отдых";

          body = `Раунд ${tb.currentRound} из ${tb.rounds} | ${phaseStr}: ${sTotal} сек`;
        } else {
          // Если ничего не работает — убиваем службу
          if (fgInterval) clearInterval(fgInterval);
          await ForegroundService.stop();
          return;
        }

        // Обновляем (или создаем) системную службу
        await ForegroundService.start({
          id: 101, // Фиксированный ID
          title: title,
          body: body,
          smallIcon: "ic_stat_name", // Системная иконка
        }).catch(() => {});
      }

      // Отслеживаем сворачивание и разворачивание приложения
      App.addListener("appStateChange", async ({ isActive }) => {
        const isTimerRunning =
          sw.isRunning ||
          tm.isRunning ||
          (tb.status !== "STOPPED" && !tb.paused);

        if (!isActive) {
          // Приложение свернуто
          if (isTimerRunning) {
            sm.unlock(); // Разблокируем аудиоконтекст
            requestWakeLock(); // Держим процессор

            // Запускаем службу и начинаем обновлять шторку каждую секунду
            updateForegroundNotification();
            fgInterval = setInterval(updateForegroundNotification, 1000);
          }
        } else {
          // Приложение развернуто на экран
          // Чистим интервал и останавливаем службу (шторка исчезнет)
          if (fgInterval) {
            clearInterval(fgInterval);
            fgInterval = null;
          }
          await ForegroundService.stop().catch(() => {});
        }
      });
    }
  }
});
