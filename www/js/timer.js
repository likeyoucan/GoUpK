import {
  $,
  showToast,
  pad,
  formatTime,
  updateText,
  updateTitle,
  requestWakeLock,
  releaseWakeLock,
  bgWorker,
  announceToScreenReader,
} from "./utils.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { store } from "./store.js?v=VERSION";

// Переменная уровня модуля для хранения оставшегося времени.
// Это позволяет фоновому воркеру обновлять ее, даже когда вкладка неактивна.
let timeRemainingMs = 0;

// Вспомогательные функции, специфичные для этого модуля
const getAdjustmentAmount = (remainingSeconds) => {
  if (remainingSeconds > 3600) return 900;
  if (remainingSeconds > 1800) return 300;
  if (remainingSeconds > 900) return 60;
  if (remainingSeconds > 300) return 30;
  if (remainingSeconds > 60) return 15;
  return 5;
};

const formatAdjustmentText = (seconds) => {
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60}m`;
};

export const tm = {
  // Состояние модуля
  totalDuration: 0,
  remainingAtPause: 0,
  isRunning: false,
  isPaused: false,
  rAF: null,
  els: {},
  ringLength: 282.74,
  currentAdjustmentSec: 0,

  /**
   * Публичный метод для получения оставшегося времени.
   * @returns {number} Время в миллисекундах.
   */
  getRemainingTime() {
    if (!this.isRunning && !this.isPaused) return 0;
    return timeRemainingMs;
  },

  init() {
    // 1. Кэширование DOM-элементов
    this.els = {
      form: $("tm-form"),
      inputs: $("tm-inputs"),
      resetBtn: $("tm-resetBtn"),
      resetBtnWrap: $("tm-resetBtn-wrap"),
      circleBtn: $("tm-circleBtn"),
      status: $("tm-statusText"),
      display: $("tm-mainDisplay"),
      ring: $("tm-progressRing"),
      h: $("tm-h"),
      m: $("tm-m"),
      s: $("tm-s"),
      adjustControls: $("tm-adjust-controls"),
      adjustPlusBtn: $("tm-adjust-plus"),
      adjustMinusBtn: $("tm-adjust-minus"),
      plusValueSpan: $("tm-plus-value"),
      minusValueSpan: $("tm-minus-value"),
    };

    if (this.els.ring) {
      this.els.ring.style.strokeDasharray = this.ringLength;
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }

    // 2. Привязка обработчиков событий
    this._bindEvents();
  },

  _bindEvents() {
    // Глобальные события
    document.addEventListener("timerStarted", (e) => {
      if (e.detail !== "timer" && this.isRunning) this.toggle();
    });

    // Управление таймером
    this.els.circleBtn?.addEventListener("click", () => this.toggle());
    this.els.resetBtn?.addEventListener("click", () => this.reset(true));

    // Управление формой
    this.els.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      document.activeElement?.blur();
    });

    // Настройка полей ввода времени
    this._setupTimeInput(this.els.h, 99, false);
    this._setupTimeInput(this.els.m, 59, true);
    this._setupTimeInput(this.els.s, 59, true);

    // Управление кнопками +/- во время работы таймера
    this.els.adjustPlusBtn?.addEventListener("click", () => this._adjustTime(true));
    this.els.adjustMinusBtn?.addEventListener("click", () => this._adjustTime(false));

    // Обработка сообщений от фонового воркера
    bgWorker.addEventListener("message", (e) => {
      if (e.data.type !== "tick") return;

      timeRemainingMs = e.data.time;

      if (this.isRunning) {
        this.updateDisplay(timeRemainingMs);
        this._updateAdjustButtons();
      }

      if (timeRemainingMs <= 0 && this.isRunning) {
        this._onTimerFinish();
      }
    });
  },

  _setupTimeInput(input, max, isWrap) {
    if (!input) return;

    // Обработчики для полей ввода (focus, input, blur)
    input.addEventListener("focus", () => {
      if (input.value === "00" || input.value === "0") input.value = "";
    });
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 2);
      if (parseInt(input.value, 10) > max) input.value = String(max);
    });
    input.addEventListener("blur", () => {
      input.value = pad(input.value || 0);
    });

    // Логика для скролла/свайпа
    let startY = 0;
    const threshold = 15;
    const updateVal = (delta) => {
      let val = parseInt(input.value || 0, 10);
      val += delta;
      if (isWrap) {
        val = (val + max + 1) % (max + 1);
      } else {
        val = Math.max(0, Math.min(max, val));
      }
      input.value = pad(val);
      sm.play("click");
      sm.vibrate(10, "tactile");
    };

    input.addEventListener("wheel", (e) => { e.preventDefault(); updateVal(e.deltaY > 0 ? -1 : 1); }, { passive: false });
    input.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
    input.addEventListener("touchmove", (e) => {
      const currentY = e.touches[0].clientY;
      const diff = startY - currentY;
      if (Math.abs(diff) > threshold) {
        e.preventDefault();
        if (document.activeElement === input) input.blur();
        updateVal(diff > 0 ? 1 : -1);
        startY = currentY;
      }
    }, { passive: false });
  },

  toggle() {
    sm.vibrate(40, "light");
    sm.play("click");
    sm.unlock();

    if (this.isRunning) {
      this._pause();
    } else {
      this._startOrResume();
    }
  },

  _startOrResume() {
    document.dispatchEvent(new CustomEvent("timerStarted", { detail: "timer" }));
    let duration;

    if (this.isPaused) {
      duration = this.remainingAtPause;
    } else {
      const h = parseInt(this.els.h?.value, 10) || 0;
      const m = parseInt(this.els.m?.value, 10) || 0;
      const s = parseInt(this.els.s?.value, 10) || 0;
      this.totalDuration = (h * 3600 + m * 60 + s) * 1000;
      duration = this.totalDuration;
    }

    if (duration <= 0) {
      showToast(t("timer_zero"));
      const elToShake = this.els.form || this.els.inputs;
      elToShake.classList.add("animate-shake");
      setTimeout(() => elToShake.classList.remove("animate-shake"), 300);
      return;
    }

    store.setActiveTimer("timer");
    this.isRunning = true;
    this.isPaused = false;
    requestWakeLock();
    this._updateUIState();
    bgWorker.postMessage({ command: "start", time: duration });
    this._updateAdjustButtons();
    this.tick();
  },

  _pause() {
    store.clearActiveTimer();
    this.isRunning = false;
    this.isPaused = true;
    this.remainingAtPause = timeRemainingMs;
    bgWorker.postMessage({ command: "stop" });
    cancelAnimationFrame(this.rAF);
    releaseWakeLock();
    updateTitle("");
    this._updateUIState();
  },
  
  _onTimerFinish() {
      this.isRunning = false;
      store.clearActiveTimer();
      sm.vibrate([200, 100, 200, 100, 400], "strong");
      sm.play("complete");
      announceToScreenReader(t("timer_finished"));
      requestAnimationFrame(() => {
        showToast(t("timer_finished"));
        this.reset(false);
      });
  },

  reset(clearInputs = true) {
    sm.vibrate(30, "medium");
    sm.play("click");
    store.clearActiveTimer();

    this.isRunning = false;
    this.isPaused = false;
    this.totalDuration = 0;
    
    bgWorker.postMessage({ command: "reset" });
    cancelAnimationFrame(this.rAF);
    releaseWakeLock();
    updateTitle("");

    if (clearInputs) {
      if (this.els.h) this.els.h.value = "00";
      if (this.els.m) this.els.m.value = "00";
      if (this.els.s) this.els.s.value = "00";
    }

    this._updateUIState();
    if (this.els.ring) this.els.ring.style.strokeDashoffset = this.ringLength;
    updateText(this.els.display, "GO");
    this.els.display.classList.add("is-go");
  },

  _adjustTime(isAdding) {
    sm.play("tick");
    sm.vibrate(50, "medium");
    const adjustmentMs = (isAdding ? 1 : -1) * this.currentAdjustmentSec * 1000;
    this.totalDuration += adjustmentMs;
    bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
  },

  _updateUIState() {
    if (!this.els.form) return;

    const showInputs = !this.isRunning && !this.isPaused;
    const showReset = this.isPaused;
    const showAdjust = this.isRunning;
    const showPauseStatus = this.isPaused;
    
    this.els.form.classList.toggle("hidden", !showInputs);
    this.els.resetBtnWrap?.classList.toggle("hidden", !showReset);
    this.els.adjustControls?.classList.toggle("hidden", !showAdjust);
    this.els.adjustControls?.classList.toggle("flex", showAdjust);
    this.els.status?.classList.toggle("hidden", !showPauseStatus);
    
    if (showPauseStatus) {
      updateText(this.els.status, t("pause"));
    }
    if (showInputs) {
      this.els.display?.classList.add("is-go");
      updateText(this.els.display, "GO");
    } else {
      this.els.display?.classList.remove("is-go");
    }
  },

  _updateAdjustButtons() {
    if (!this.isRunning) return;
    const remainingSeconds = Math.ceil(timeRemainingMs / 1000);
    const newAdjustmentSec = getAdjustmentAmount(remainingSeconds);

    if (newAdjustmentSec !== this.currentAdjustmentSec) {
      this.currentAdjustmentSec = newAdjustmentSec;
      const text = formatAdjustmentText(this.currentAdjustmentSec);
      updateText(this.els.plusValueSpan, `+ ${text}`);
      updateText(this.els.minusValueSpan, `- ${text}`);
    }
  },

  tick() {
    if (!this.isRunning) {
      cancelAnimationFrame(this.rAF);
      return;
    }
    this.updateDisplay(timeRemainingMs);
    this.rAF = requestAnimationFrame(() => this.tick());
  },

  updateDisplay(rem) {
    const hInput = parseInt(this.els.h?.value, 10) || 0;
    const forceHours = hInput > 0 || this.totalDuration >= 3600000;
    const timeStr = formatTime(rem, { forceHours });

    updateText(this.els.display, timeStr);
    updateTitle(timeStr);

    if (this.els.ring && this.totalDuration > 0) {
      const elapsed = this.totalDuration - rem;
      const progress = Math.max(0, Math.min(1, elapsed / this.totalDuration));
      this.els.ring.style.strokeDashoffset = this.ringLength * (1 - progress);
    }
  },
};