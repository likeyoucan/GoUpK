// Файл: www/js/touch-range.js

/**
 * touch-range.js
 *
 * Модуль безопасного сенсорного взаимодействия с input[type=range].
 *
 * Проблема: нативный input[type=range] перехватывает touchstart сразу,
 * не давая странице понять — это скролл или перетаскивание ползунка.
 * Даже touch-action: pan-y не помогает, потому что браузер решает
 * за вас ещё до первого touchmove.
 *
 * Решение: скрываем нативный input, рисуем кастомный трек поверх.
 * Перетаскивание начинается ТОЛЬКО после того, как пользователь
 * явно двигается горизонтально (|dx| > |dy| и порог 6px).
 * Вертикальный свайп — всегда пропускается для скролла страницы.
 *
 * Использование:
 *   import { initTouchRanges } from './touch-range.js?v=VERSION';
 *
 *   // Инициализировать все на странице:
 *   initTouchRanges();
 *
 * CSS-переменные для кастомизации (опционально):
 *   --tr-track-height: 4px
 *   --tr-thumb-size:   22px
 *   --tr-track-bg:     rgba(0,0,0,0.12)
 *   --tr-fill-color:   var(--primary-color, #22c55e)
 *   --tr-thumb-color:  var(--primary-color, #22c55e)
 */
import { sm } from "./sound.js?v=VERSION";

// ─── Вставляем базовые стили один раз ────────────────────────────────────────
const STYLE_ID = "__touch_range_styles__";
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* Обёртка */
    .tr-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: var(--tr-thumb-size, 22px);
      cursor: pointer;
      -webkit-user-select: none;
      user-select: none;
      touch-action: pan-y;   /* разрешаем браузеру скроллить вертикально */
    }

    /* Скрытый нативный input (остаётся в DOM для доступности и событий) */
    .tr-native {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      margin: 0;
      padding: 0;
      -webkit-appearance: none;
      appearance: none;
      touch-action: none;    /* полностью отдаём управление нашему коду */
      z-index: 2;
      pointer-events: none;  /* клики идут на обёртку, не на input */
    }

    /* Трек */
    .tr-track {
      position: relative;
      width: 100%;
      height: var(--tr-track-height, 4px);
      border-radius: 9999px;
      background: var(--tr-track-bg, rgba(128,128,128,0.25));
      overflow: visible;
    }

    /* Заливка слева от бегунка */
    .tr-fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: 9999px;
      background: var(--tr-fill-color, var(--primary-color, #22c55e));
      pointer-events: none;
      transition: width 0.05s linear;
    }

    /* Бегунок */
    .tr-thumb {
      position: absolute;
      top: 50%;
      width: var(--tr-thumb-size, 22px);
      height: var(--tr-thumb-size, 22px);
      border-radius: 50%;
      background: var(--tr-thumb-color, var(--primary-color, #22c55e));
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      transform: translate(-50%, -50%);
      transition: left 0.05s linear, transform 0.15s ease, box-shadow 0.15s ease;
      pointer-events: none;
      z-index: 1;
    }

    /* Состояние активного перетаскивания */
    .tr-wrap.tr-dragging .tr-thumb {
      transform: translate(-50%, -50%) scale(1.25);
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    /* Фокус-стиль для клавиатуры */
    .tr-wrap:focus-within .tr-thumb,
    .tr-wrap.tr-focused .tr-thumb {
      box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb, 34,197,94), 0.3),
                  0 1px 4px rgba(0,0,0,0.25);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Создаёт кастомный ползунок поверх нативного input[type=range].
 * Нативный input скрывается визуально, но остаётся в DOM.
 *
 * @param {HTMLInputElement} input - нативный input[type=range]
 */
export function enhanceNativeRange(input) {
  if (!input || input.type !== "range") return;
  if (input.dataset.trEnhanced) return; // уже улучшен
  input.dataset.trEnhanced = "1";

  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const step = parseFloat(input.step) || 1;
  let value = parseFloat(input.value) || min;

  let lastVibroTime = 0;
  const VIBRO_THROTTLE_MS = 75;

  // Создаём обёртку
  const wrap = document.createElement("div");
  wrap.className = "tr-wrap";
  wrap.setAttribute("role", "slider");
  wrap.setAttribute("aria-valuemin", min);
  wrap.setAttribute("aria-valuemax", max);
  wrap.setAttribute("aria-valuenow", value);
  wrap.setAttribute("tabindex", "0");
  if (input.getAttribute("aria-label")) {
    wrap.setAttribute("aria-label", input.getAttribute("aria-label"));
  }
  if (input.id) {
    wrap.setAttribute("aria-controls", input.id);
  }

  // Трек + заливка + бегунок
  const track = document.createElement("div");
  track.className = "tr-track";
  const fill = document.createElement("div");
  fill.className = "tr-fill";
  const thumb = document.createElement("div");
  thumb.className = "tr-thumb";
  track.appendChild(fill);
  track.appendChild(thumb);

  // Добавляем input внутрь обёртки (скрытый)
  input.classList.add("tr-native");
  wrap.appendChild(track);
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  // ── Функция обновления визуала ───────────────────────────────────────────
  const updateVisual = (val) => {
    const pct = (val - min) / (max - min);
    fill.style.width = `${pct * 100}%`;
    thumb.style.left = `${pct * 100}%`;
    wrap.setAttribute("aria-valuenow", val);
  };

  updateVisual(value);

  // ── Функция вычисления значения по X-позиции касания/клика ──────────────
  const valueFromX = (clientX) => {
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + pct * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, parseFloat(stepped.toFixed(10))));
  };

  // ── Синхронизация с нативным input и dispatch события ───────────────────
  const applyValue = (val, eventType = "input") => {
    const clamped = Math.max(min, Math.min(max, val));
    const snapped = Math.round((clamped - min) / step) * step + min;
    const final = parseFloat(Math.max(min, Math.min(max, snapped)).toFixed(10));

    if (final === parseFloat(input.value) && eventType === "input") return;

    value = final;
    input.value = final; // Этот сеттер вызовет наш кастомный обработчик ниже
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
  };

  // ─── TOUCH-логика ────────────────────────────────────────────────────────
  let touchState = {
    active: false,
    decided: false,
    isHoriz: false,
    startX: 0,
    startY: 0,
    id: null,
  };
  const DECISION_THRESHOLD = 6;

  const onTouchStart = (e) => {
    if (touchState.active) return;
    const touch = e.changedTouches[0];
    touchState = {
      active: true,
      decided: false,
      isHoriz: false,
      startX: touch.clientX,
      startY: touch.clientY,
      id: touch.identifier,
    };
  };

  const onTouchMove = (e) => {
    if (!touchState.active) return;
    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchState.id) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch) return;

    const dx = touch.clientX - touchState.startX;
    const dy = touch.clientY - touchState.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!touchState.decided) {
      if (dist < DECISION_THRESHOLD) return;
      touchState.decided = true;
      touchState.isHoriz = Math.abs(dx) >= Math.abs(dy);
      if (touchState.isHoriz) {
        wrap.classList.add("tr-dragging");
      } else {
        touchState.active = false;
        return;
      }
    }

    if (!touchState.isHoriz) return;
    e.preventDefault();

    const now = performance.now();
    if (now - lastVibroTime > VIBRO_THROTTLE_MS) {
      sm.vibrate(10, "tactile");
      lastVibroTime = now;
    }

    applyValue(valueFromX(touch.clientX), "input");
  };

  const onTouchEnd = (e) => {
    if (!touchState.active) return;
    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchState.id) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (touchState.isHoriz) {
      if (touch) applyValue(valueFromX(touch.clientX), "change");
      wrap.classList.remove("tr-dragging");
    }
    touchState.active = false;
    touchState.decided = false;
    touchState.isHoriz = false;
  };

  wrap.addEventListener("touchstart", onTouchStart, { passive: true });
  wrap.addEventListener("touchmove", onTouchMove, { passive: false });
  wrap.addEventListener("touchend", onTouchEnd, { passive: true });
  wrap.addEventListener("touchcancel", onTouchEnd, { passive: true });

  // ─── MOUSE-логика ────────────────────────────────────────────────────────
  let mouseDown = false;

  wrap.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDown = true;
    wrap.classList.add("tr-dragging");
    applyValue(valueFromX(e.clientX), "input");
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;

    const now = performance.now();
    if (now - lastVibroTime > VIBRO_THROTTLE_MS) {
      sm.vibrate(10, "tactile");
      lastVibroTime = now;
    }

    applyValue(valueFromX(e.clientX), "input");
  });

  document.addEventListener("mouseup", (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    wrap.classList.remove("tr-dragging");
    applyValue(valueFromX(e.clientX), "change");
  });

  // ─── CLICK по треку ──────────────────────────────────────────────────────
  track.addEventListener("click", (e) => {
    applyValue(valueFromX(e.clientX), "change");
  });

  // ─── KEYBOARD ────────────────────────────────────────────────────────────
  wrap.addEventListener("keydown", (e) => {
    let newVal = value;
    const bigStep = (max - min) / 10; // Стандартное поведение для PageUp/Down

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        newVal += step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        newVal -= step;
        break;
      case "PageUp":
        newVal += bigStep;
        break;
      case "PageDown":
        newVal -= bigStep;
        break;
      case "Home":
        newVal = min;
        break;
      case "End":
        newVal = max;
        break;
      default:
        return;
    }

    e.preventDefault();
    applyValue(newVal, "input");
    // Финальное событие для клавиатуры
    if (["Home", "End"].includes(e.key) || !e.repeat) {
      applyValue(newVal, "change");
    }
  });

  wrap.addEventListener("focus", () => wrap.classList.add("tr-focused"));
  wrap.addEventListener("blur", () => wrap.classList.remove("tr-focused"));

  // ─── Следим за внешними изменениями input.value ──────────────────────────
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  if (originalDescriptor) {
    Object.defineProperty(input, "value", {
      get() {
        return originalDescriptor.get.call(this);
      },
      set(v) {
        // Устанавливаем нативное значение
        originalDescriptor.set.call(this, v);

        const newVal = parseFloat(v);
        if (!isNaN(newVal)) {
          // Синхронизируем внутреннюю переменную и визуальное представление.
          value = newVal;
          updateVisual(newVal);
        }
      },
      configurable: true,
    });
  }

  // После того, как мы определили новый сеттер,
  // принудительно "переустанавливаем" текущее значение,
  // чтобы `updateVisual` точно сработал.
  input.value = value;

  return wrap;
}

/**
 * Инициализирует все нативные input[type=range] на странице.
 *
 * @param {string} [selector='input[type="range"]'] - CSS-селектор
 * @param {Element} [root=document] - корневой элемент для поиска
 */
export function initTouchRanges(
  selector = 'input[type="range"]',
  root = document,
) {
  root.querySelectorAll(selector).forEach((input) => {
    enhanceNativeRange(input);
  });
}
