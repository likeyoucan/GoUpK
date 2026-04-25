// Файл: www/js/touch-range.js

// Intentionally no sm import here:
// touch-range should only handle value updates and events,
// while sound/vibration stays in feature modules (e.g. sound.js).

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
  let value = parseFloat(input.value);
  if (!Number.isFinite(value)) value = min;

  let suppressTrackClickUntil = 0;

  const wrap = document.createElement("div");
  wrap.className = "tr-wrap";
  wrap.setAttribute("role", "slider");
  wrap.setAttribute("aria-valuemin", String(min));
  wrap.setAttribute("aria-valuemax", String(max));
  wrap.setAttribute("aria-valuenow", String(value));
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
  track.append(fill, thumb);

  input.classList.add("tr-native");
  wrap.appendChild(track);
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const originalDescriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );

  const updateVisual = (val) => {
    const range = max - min || 1;
    const pct = (val - min) / range;
    fill.style.width = `${pct * 100}%`;
    thumb.style.left = `${pct * 100}%`;
    wrap.setAttribute("aria-valuenow", String(val));
  };

  const valueFromX = (clientX) => {
    const rect = track.getBoundingClientRect();
    const width = rect.width || 1;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / width));
    const raw = min + pct * (max - min);
    const stepped = Math.round((raw - min) / step) * step + min;
    return Math.max(min, Math.min(max, parseFloat(stepped.toFixed(10))));
  };

  // Returns true only if value actually changed
  const applyValue = (val, eventType = "input") => {
    const clamped = Math.max(min, Math.min(max, val));
    const snapped = Math.round((clamped - min) / step) * step + min;
    const final = parseFloat(snapped.toFixed(10));
    const current = parseFloat(input.value);

    if (Number.isFinite(current) && final === current) return false;

    value = final;

    if (originalDescriptor?.set) {
      originalDescriptor.set.call(input, String(final));
    } else {
      input.value = String(final);
    }

    updateVisual(final);
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
    return true;
  };

  const emitChange = () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // ---------- TOUCH ----------
  let touchState = {
    active: false,
    decided: false,
    isHoriz: false,
    moved: false,
    id: null,
    startX: 0,
    startY: 0,
  };

  const DECISION_THRESHOLD = 6;

  const onTouchStart = (e) => {
    if (touchState.active) return;
    const touch = e.changedTouches[0];
    touchState = {
      active: true,
      decided: false,
      isHoriz: false,
      moved: false,
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
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
    const dist = Math.hypot(dx, dy);

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

    // No preventDefault here (avoids intervention warning)
    const changed = applyValue(valueFromX(touch.clientX), "input");
    if (changed) {
      touchState.moved = true;
    }
  };

  const onTouchEnd = () => {
    if (!touchState.active) return;

    if (touchState.isHoriz && touchState.moved) {
      emitChange();
      suppressTrackClickUntil = performance.now() + 250;
    }

    wrap.classList.remove("tr-dragging");
    touchState.active = false;
    touchState.decided = false;
    touchState.isHoriz = false;
    touchState.moved = false;
  };

  wrap.addEventListener("touchstart", onTouchStart, { passive: true });
  wrap.addEventListener("touchmove", onTouchMove, { passive: true });
  wrap.addEventListener("touchend", onTouchEnd, { passive: true });
  wrap.addEventListener("touchcancel", onTouchEnd, { passive: true });

  // ---------- MOUSE ----------
  let mouseDown = false;
  let mouseMoved = false;
  let mouseStartX = 0;
  let mouseStartY = 0;
  const MOUSE_MOVE_THRESHOLD = 2;

  const onMouseMove = (e) => {
    if (!mouseDown) return;

    const dx = e.clientX - mouseStartX;
    const dy = e.clientY - mouseStartY;
    if (!mouseMoved && Math.hypot(dx, dy) < MOUSE_MOVE_THRESHOLD) return;

    if (!mouseMoved) {
      mouseMoved = true;
      wrap.classList.add("tr-dragging");
    }

    const changed = applyValue(valueFromX(e.clientX), "input");
    if (changed) mouseMoved = true;
  };

  const onMouseUp = () => {
    if (!mouseDown) return;

    mouseDown = false;

    if (mouseMoved) {
      emitChange();
      suppressTrackClickUntil = performance.now() + 250;
    }

    mouseMoved = false;
    wrap.classList.remove("tr-dragging");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  wrap.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDown = true;
    mouseMoved = false;
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;

    // No value update on down (prevents phantom first input/sound)
    e.preventDefault();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  // Track click: exactly one input + one change if changed
  track.addEventListener("click", (e) => {
    if (performance.now() < suppressTrackClickUntil) return;

    const changed = applyValue(valueFromX(e.clientX), "input");
    if (changed) emitChange();
  });

  // ---------- KEYBOARD ----------
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
    const changed = applyValue(newVal, "input");
    if (changed) emitChange();
  });

  wrap.addEventListener("focus", () => wrap.classList.add("tr-focused"));
  wrap.addEventListener("blur", () => wrap.classList.remove("tr-focused"));

  if (originalDescriptor) {
    Object.defineProperty(input, "value", {
      get() {
        return originalDescriptor.get.call(this);
      },
      set(v) {
        originalDescriptor.set.call(this, v);
        const newVal = parseFloat(v);
        if (!Number.isNaN(newVal)) {
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

  if (originalDescriptor?.set) {
    originalDescriptor.set.call(input, String(value));
  } else {
    input.value = String(value);
  }
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