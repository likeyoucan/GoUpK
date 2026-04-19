// Файл: www/js/timer.js

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

let timeRemainingMs = 0;

function getAdjustmentAmount(remainingSeconds) {
  if (remainingSeconds > 3600) return 900;
  if (remainingSeconds > 1800) return 300;
  if (remainingSeconds > 900) return 60;
  if (remainingSeconds > 300) return 30;
  if (remainingSeconds > 60) return 15;
  return 5;
}

function formatAdjustmentText(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else {
    return `${seconds / 60}m`;
  }
}

export const tm = {
  totalDuration: 0,
  targetTime: 0,
  remainingAtPause: 0,
  isRunning: false,
  isPaused: false,
  rAF: null,
  lastRender: 0,
  els: {},
  ringLength: 282.74,
  currentAdjustmentSec: 0,

  getRemainingTime() {
    if (!this.isRunning && !this.isPaused) return 0;
    return timeRemainingMs;
  },

  init() {
    this.els = {
      // FIX 1: Добавляем саму форму в список элементов
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

    document.addEventListener("timerStarted", (e) => {
      if (e.detail !== "timer" && this.isRunning) this.toggle();
    });

    this.els.circleBtn?.addEventListener("click", () => this.toggle());
    this.els.resetBtn?.addEventListener("click", () => this.reset(true));

    this.els.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      document.activeElement?.blur();
    });

    [this.els.m, this.els.s].forEach((i) => {
      if (!i) return;
      i.addEventListener("focus", () => {
        if (i.value === "00" || i.value === "0") i.value = "";
      });
      i.addEventListener("input", () => {
        i.value = i.value.replace(/\D/g, "").slice(0, 2);
        if (parseInt(i.value, 10) > 59) i.value = "59";
      });
      i.addEventListener("blur", () => {
        i.value = pad(i.value || 0);
      });
    });

    if (this.els.h) {
      this.els.h.addEventListener("focus", () => {
        if (this.els.h.value === "00" || this.els.h.value === "0")
          this.els.h.value = "";
      });
      this.els.h.addEventListener("input", () => {
        this.els.h.value = this.els.h.value.replace(/\D/g, "").slice(0, 2);
        if (parseInt(this.els.h.value, 10) > 99) this.els.h.value = "99";
      });
      this.els.h.addEventListener("blur", () => {
        this.els.h.value = pad(this.els.h.value || 0);
      });
    }

    this.setupScrollInteraction(this.els.h, 99, false);
    this.setupScrollInteraction(this.els.m, 59, true);
    this.setupScrollInteraction(this.els.s, 59, true);

    bgWorker.addEventListener("message", (e) => {
      if (e.data.type === "tick") {
        const remaining = e.data.time;
        timeRemainingMs = remaining;

        if (this.isRunning) {
          this.targetTime = performance.now() + remaining;
          this.updateDisplay(remaining);
          this.updateAdjustButtons();
        }

        if (remaining <= 0 && this.isRunning) {
          this.isRunning = false;
          store.clearActiveTimer();

          sm.vibrate([200, 100, 200, 100, 400], "strong");
          sm.play("complete");
          announceToScreenReader(t("timer_finished"));
          requestAnimationFrame(() => {
            showToast(t("timer_finished"));
            this.reset(false);
          });
        }
      }
    });

    this.els.adjustPlusBtn?.addEventListener("click", () => {
      sm.play("tick");
      sm.vibrate(50, "medium");
      const adjustmentMs = this.currentAdjustmentSec * 1000;
      this.totalDuration += adjustmentMs;
      bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
    });

    this.els.adjustMinusBtn?.addEventListener("click", () => {
      sm.play("tick");
      sm.vibrate(50, "medium");
      const adjustmentMs = -this.currentAdjustmentSec * 1000;
      this.totalDuration += adjustmentMs;
      bgWorker.postMessage({ command: "adjust", time: adjustmentMs });
    });
  },

  setupScrollInteraction(input, max, isWrap) {
    if (!input) return;
    let startY = 0;
    const threshold = 15;
    const updateVal = (delta) => {
      let val = parseInt(input.value || 0, 10);
      val += delta;
      if (isWrap) {
        if (val > max) val = 0;
        if (val < 0) val = max;
      } else {
        val = Math.max(0, Math.min(max, val));
      }
      input.value = pad(val);
      sm.play("click");
      sm.vibrate(10, "tactile");
    };
    input.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        updateVal(e.deltaY > 0 ? -1 : 1);
      },
      { passive: false },
    );
    input.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches[0].clientY;
      },
      { passive: true },
    );
    input.addEventListener(
      "touchmove",
      (e) => {
        const currentY = e.touches[0].clientY;
        const diff = startY - currentY;
        if (Math.abs(diff) > threshold) {
          e.preventDefault();
          if (document.activeElement === input) input.blur();
          updateVal(diff > 0 ? 1 : -1);
          startY = currentY;
        }
      },
      { passive: false },
    );
    let isDragging = false;
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const currentY = e.clientY;
      const diff = startY - currentY;
      if (Math.abs(diff) > threshold) {
        updateVal(diff > 0 ? 1 : -1);
        startY = currentY;
      }
    };
    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseUp);
      window.removeEventListener("blur", onMouseUp);
    };
    input.addEventListener("mousedown", (e) => {
      isDragging = true;
      startY = e.clientY;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      document.addEventListener("mouseleave", onMouseUp);
      window.addEventListener("blur", onMouseUp);
    });
  },

  toggle() {
    sm.vibrate(50, "strong");
    sm.play("click");
    sm.unlock();
    if (this.isRunning) {
      store.clearActiveTimer();

      this.isRunning = false;
      this.isPaused = true;
      this.remainingAtPause = timeRemainingMs;
      bgWorker.postMessage({ command: "stop" });
      cancelAnimationFrame(this.rAF);
      releaseWakeLock();
      updateTitle("");
      this.updateUIState();
    } else {
      document.dispatchEvent(
        new CustomEvent("timerStarted", { detail: "timer" }),
      );
      let duration;
      if (!this.isPaused) {
        const h = parseInt(this.els.h?.value, 10) || 0;
        const m = parseInt(this.els.m?.value, 10) || 0;
        const s = parseInt(this.els.s?.value, 10) || 0;
        this.totalDuration = (h * 3600 + m * 60 + s) * 1000;
        duration = this.totalDuration;
        timeRemainingMs = this.totalDuration;
        this.currentAdjustmentSec = 0;
      } else {
        duration = this.remainingAtPause;
      }

      if (duration <= 0) {
        showToast(t("timer_zero"));
        // Используем form для анимации, если она есть, иначе inputs
        const elToShake = this.els.form || this.els.inputs;
        elToShake.classList.add("animate-shake");
        setTimeout(() => elToShake.classList.remove("animate-shake"), 300);
        return;
      }

      store.setActiveTimer("timer");

      this.isRunning = true;
      this.isPaused = false;
      this.targetTime = performance.now() + duration;
      requestWakeLock();
      this.updateUIState();
      bgWorker.postMessage({ command: "start", time: duration });
      this.updateAdjustButtons();
      this.tick();
    }
  },

  reset(clearInputs = true) {
    sm.vibrate(30, "medium");
    sm.play("click");
    store.clearActiveTimer();

    this.isRunning = false;
    this.isPaused = false;
    bgWorker.postMessage({ command: "reset" });
    cancelAnimationFrame(this.rAF);
    releaseWakeLock();
    updateTitle("");
    if (clearInputs) {
      if (this.els.h) this.els.h.value = "00";
      if (this.els.m) this.els.m.value = "00";
      if (this.els.s) this.els.s.value = "00";
    }
    this.totalDuration = 0;
    this.updateUIState();
    if (this.els.ring) {
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }
    updateText(this.els.display, "GO");
    this.els.display.classList.add("is-go");
  },

  // FIX 2: Обновляем функцию для управления видимостью всей формы
  updateUIState() {
    if (!this.els.form) return;
    if (this.isRunning) {
      this.els.form.classList.add("hidden");
      this.els.resetBtnWrap?.classList.add("hidden");
      this.els.status?.classList.add("hidden");
      this.els.display?.classList.remove("is-go");
      this.els.adjustControls?.classList.remove("hidden");
      this.els.adjustControls?.classList.add("flex");
    } else if (this.isPaused) {
      this.els.form.classList.add("hidden");
      this.els.resetBtnWrap?.classList.remove("hidden");
      this.els.status?.classList.remove("hidden");
      updateText(this.els.status, t("pause"));
      this.els.adjustControls?.classList.add("hidden");
      this.els.adjustControls?.classList.remove("flex");
    } else {
      this.els.form.classList.remove("hidden");
      this.els.resetBtnWrap?.classList.add("hidden");
      this.els.status?.classList.add("hidden");
      this.els.display?.classList.add("is-go");
      updateText(this.els.display, "GO");
      this.els.adjustControls?.classList.add("hidden");
      this.els.adjustControls?.classList.remove("flex");
    }
  },

  updateAdjustButtons() {
    if (!this.isRunning) return;
    const remainingSeconds = Math.ceil(timeRemainingMs / 1000);
    const newAdjustmentSec = getAdjustmentAmount(remainingSeconds);

    if (newAdjustmentSec === this.currentAdjustmentSec) {
      return;
    }

    this.currentAdjustmentSec = newAdjustmentSec;
    const text = formatAdjustmentText(this.currentAdjustmentSec);
    updateText(this.els.plusValueSpan, `+ ${text}`);
    updateText(this.els.minusValueSpan, `- ${text}`);
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
