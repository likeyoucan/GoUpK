// Файл: www/js/touch-range.js

import { sm } from "./sound.js?v=VERSION";

const STYLE_ID = "__touch_range_styles__";
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .tr-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: var(--tr-thumb-size, 22px);
      cursor: pointer;
      -webkit-user-select: none;
      user-select: none;
      touch-action: pan-y;
    }
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
      touch-action: none;
      z-index: 2;
      pointer-events: none;
    }
    .tr-track {
      position: relative;
      width: 100%;
      height: var(--tr-track-height, 4px);
      border-radius: 9999px;
      background: var(--tr-track-bg, rgba(128,128,128,0.25));
      overflow: visible;
    }
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
    .tr-wrap.tr-dragging .tr-thumb {
      transform: translate(-50%, -50%) scale(1.25);
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    .tr-wrap:focus-within .tr-thumb,
    .tr-wrap.tr-focused .tr-thumb {
      box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb, 34,197,94), 0.3),
                  0 1px 4px rgba(0,0,0,0.25);
    }
  `;
  document.head.appendChild(style);
}

export function enhanceNativeRange(input) {
  if (!input || input.type !== "range") return;
  if (input.dataset.trEnhanced) return;
  input.dataset.trEnhanced = "1";

  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const step = parseFloat(input.step) || 1;
  let value = parseFloat(input.value) || min;

  let lastVibroTime = 0;
  const VIBRO_THROTTLE_MS = 75;

  // FIX: подавление дублирующего click после mouseup / touch drag
  let suppressTrackClickUntil = 0;

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

  const track = document.createElement("div");
  track.className = "tr-track";
  const fill = document.createElement("div");
  fill.className = "tr-fill";
  const thumb = document.createElement("div");
  thumb.className = "tr-thumb";
  track.appendChild(fill);
  track.appendChild(thumb);

  input.classList.add("tr-native");
  wrap.appendChild(track);
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const updateVisual = (val) => {
    const pct = (val - min) / (max - min);
    fill.style.width = `${pct * 100}%`;
    thumb.style.left = `${pct * 100}%`;
    wrap.setAttribute("aria-valuenow", val);
  };

  updateVisual(value);

  const valueFromX = (clientX) => {
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + pct * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, parseFloat(stepped.toFixed(10))));
  };

  // FIX 1: applyValue возвращает true только если значение реально изменилось
  const applyValue = (val, eventType = "input") => {
    const clamped = Math.max(min, Math.min(max, val));
    const snapped = Math.round((clamped - min) / step) * step + min;
    const final = parseFloat(Math.max(min, Math.min(max, snapped)).toFixed(10));
    const current = parseFloat(input.value);

    // Ничего не меняем и не шлём события, если значение то же самое
    if (Number.isFinite(current) && final === current) return false;

    value = final;

    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    if (originalDescriptor) {
      originalDescriptor.set.call(input, final);
    } else {
      input.value = final;
    }

    updateVisual(final);
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
    return true;
  };

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

    // FIX 1: вибрация только при фактическом изменении значения
    const changed = applyValue(valueFromX(touch.clientX), "input");
    if (changed) {
      const now = performance.now();
      if (now - lastVibroTime > VIBRO_THROTTLE_MS) {
        sm.vibrate(10, "tactile");
        lastVibroTime = now;
      }
    }
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
      // FIX 2: после touch-drag глушим браузерный click
      suppressTrackClickUntil = performance.now() + 250;
    }
    touchState.active = false;
    touchState.decided = false;
    touchState.isHoriz = false;
  };

  wrap.addEventListener("touchstart", onTouchStart, { passive: true });
  wrap.addEventListener("touchmove", onTouchMove, { passive: false });
  wrap.addEventListener("touchend", onTouchEnd, { passive: true });
  wrap.addEventListener("touchcancel", onTouchEnd, { passive: true });

  // FIX 2: флаг активного перетаскивания мышью
  let mouseDown = false;

  const onMouseMove = (e) => {
    if (!mouseDown) return;

    // FIX 1: вибрация только при фактическом изменении значения
    const changed = applyValue(valueFromX(e.clientX), "input");
    if (changed) {
      const now = performance.now();
      if (now - lastVibroTime > VIBRO_THROTTLE_MS) {
        sm.vibrate(10, "tactile");
        lastVibroTime = now;
      }
    }
  };

  const onMouseUp = (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    wrap.classList.remove("tr-dragging");
    applyValue(valueFromX(e.clientX), "change");
    // FIX 2: после mouseup браузер сгенерит click — глушим его, чтобы не было второго change
    suppressTrackClickUntil = performance.now() + 250;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  wrap.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDown = true;
    wrap.classList.add("tr-dragging");
    applyValue(valueFromX(e.clientX), "input");
    e.preventDefault();
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  // FIX 2: track.click пропускаем, если он пришёл сразу после mouseup
  track.addEventListener("click", (e) => {
    if (performance.now() < suppressTrackClickUntil) return;
    applyValue(valueFromX(e.clientX), "change");
  });

  wrap.addEventListener("keydown", (e) => {
    let newVal = value;
    const bigStep = (max - min) / 10;

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
    if (["Home", "End"].includes(e.key) || !e.repeat) {
      applyValue(newVal, "change");
    }
  });

  wrap.addEventListener("focus", () => wrap.classList.add("tr-focused"));
  wrap.addEventListener("blur", () => wrap.classList.remove("tr-focused"));

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
        originalDescriptor.set.call(this, v);
        const newVal = parseFloat(v);
        if (!isNaN(newVal)) {
          value = newVal;
          updateVisual(newVal);
        }
      },
      configurable: true,
    });
  }

  const destroy = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    if (originalDescriptor) {
      Object.defineProperty(input, "value", originalDescriptor);
    }

    if (wrap.parentNode) {
      wrap.parentNode.insertBefore(input, wrap);
      wrap.remove();
    }

    input.classList.remove("tr-native");
    delete input.dataset.trEnhanced;
  };

  wrap._trDestroy = destroy;

  originalDescriptor.set.call(input, value);
  updateVisual(value);

  return wrap;
}

export function initTouchRanges(
  selector = 'input[type="range"]',
  root = document,
) {
  root.querySelectorAll(selector).forEach((input) => {
    enhanceNativeRange(input);
  });
}
