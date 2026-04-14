// timer.js

import {
  $,
  showToast,
  pad,
  updateText,
  updateTitle,
  requestWakeLock,
  releaseWakeLock,
  bgWorker,
  announceToScreenReader,
} from "./utils.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

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

  init() {
    this.els = {
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
      plusBtn: $("tm-plus-btn"),
      minusBtn: $("tm-minus-btn"),
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
    this.els.plusBtn?.addEventListener("click", () => this.adjustTime(1));
    this.els.minusBtn?.addEventListener("click", () => this.adjustTime(-1));
    $("tm-form")?.addEventListener("submit", (e) => {
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
      if (e.data === "tick" && this.isRunning && document.hidden)
        this.tick(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.isRunning) {
        this.lastRender = 0;
        this.tick();
      }
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
      sm.vibrate(10);
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
    sm.vibrate(50);
    sm.play("click");
    sm.unlock();
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = true;
      this.remainingAtPause = Math.max(0, this.targetTime - performance.now());
      bgWorker.postMessage("stop");
      cancelAnimationFrame(this.rAF);
      releaseWakeLock();
      updateTitle("");
      this.updateUIState();
    } else {
      document.dispatchEvent(
        new CustomEvent("timerStarted", { detail: "timer" }),
      );
      if (!this.isPaused) {
        const h = parseInt(this.els.h?.value, 10) || 0;
        const m = parseInt(this.els.m?.value, 10) || 0;
        const s = parseInt(this.els.s?.value, 10) || 0;
        this.totalDuration = (h * 3600 + m * 60 + s) * 1000;
        if (this.totalDuration === 0) {
          showToast(t("timer_zero"));
          this.els.inputs.classList.add("animate-shake");
          setTimeout(
            () => this.els.inputs.classList.remove("animate-shake"),
            300,
          );
          return;
        }
        this.targetTime = performance.now() + this.totalDuration;
      } else {
        this.targetTime = performance.now() + this.remainingAtPause;
      }
      this.isRunning = true;
      this.isPaused = false;
      requestWakeLock();
      this.updateUIState();
      bgWorker.postMessage("start");
      this.tick();
    }
  },

  reset(clearInputs = true) {
    sm.vibrate(30);
    sm.play("click");
    this.isRunning = false;
    this.isPaused = false;
    bgWorker.postMessage("stop");
    cancelAnimationFrame(this.rAF);
    releaseWakeLock();
    updateTitle("");
    if (clearInputs) {
      if (this.els.h) this.els.h.value = "00";
      if (this.els.m) this.els.m.value = "00";
      if (this.els.s) this.els.s.value = "00";
    }
    this.updateUIState();
    if (this.els.ring) {
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }
    updateText(this.els.display, "GO");
    this.els.display.classList.add("is-go");
  },

  updateUIState() {
    if (!this.els.inputs) return;
    if (this.isRunning) {
      this.els.inputs.classList.add("hidden", "opacity-0");
      this.els.resetBtnWrap?.classList.add("hidden");
      this.els.status?.classList.add("hidden");
      this.els.display?.classList.remove("is-go");
      adjustBtns.forEach((btn) => btn?.classList.remove("hidden")); // Показать кнопки
    } else if (this.isPaused) {
      this.els.inputs.classList.add("hidden", "opacity-0");
      this.els.resetBtnWrap?.classList.remove("hidden");
      this.els.status?.classList.remove("hidden");
      updateText(this.els.status, t("pause"));
      adjustBtns.forEach((btn) => btn?.classList.add("hidden")); // Скрыть кнопки
    } else {
      this.els.inputs.classList.remove("hidden", "opacity-0");
      this.els.resetBtnWrap?.classList.add("hidden");
      this.els.status?.classList.add("hidden");
      this.els.display?.classList.add("is-go");
      updateText(this.els.display, "GO");
      adjustBtns.forEach((btn) => btn?.classList.add("hidden")); // Скрыть кнопки
    }
  },

  tick(isBackground = false) {
    if (!this.isRunning) return;
    const now = performance.now();
    const remaining = Math.max(0, this.targetTime - now);
    if (now - this.lastRender >= 16 || isBackground) {
      if (!isBackground) {
        this.updateDisplay(remaining);
      } else {
        const sTotal = Math.ceil(remaining / 1000);
        updateTitle(this.getFormattedTime(sTotal));
      }
      this.lastRender = now;
    }
    if (remaining <= 0) {
      this.isRunning = false;
      bgWorker.postMessage("stop");
      sm.vibrate([200, 100, 200, 100, 400]);
      sm.play("complete");
      announceToScreenReader(t("timer_finished"));
      requestAnimationFrame(() => {
        showToast(t("timer_finished"));
        this.reset(false);
      });
      return;
    }
    if (!isBackground) {
      cancelAnimationFrame(this.rAF);
      this.rAF = requestAnimationFrame(() => this.tick());
    }
  },

  getFormattedTime(sTotal) {
    const h = Math.floor(sTotal / 3600);
    const m = Math.floor((sTotal % 3600) / 60);
    const s = sTotal % 60;
    const hInput = parseInt(this.els.h?.value, 10) || 0;
    const mInput = parseInt(this.els.m?.value, 10) || 0;
    if (hInput > 0 || h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (mInput > 0 || m > 0) return `${pad(m)}:${pad(s)}`;
    return `${s}`;
  },

  updateDisplay(rem) {
    const sTotal = Math.ceil(rem / 1000);
    const timeStr = this.getFormattedTime(sTotal);
    updateText(this.els.display, timeStr);
    updateTitle(timeStr);
    if (this.els.ring && this.totalDuration > 0) {
      this.els.ring.style.strokeDashoffset =
        this.ringLength -
        (Math.max(0, this.totalDuration - rem) / this.totalDuration) *
          this.ringLength;
    }
  },

  adjustTime(direction) {
    // direction: 1 for plus, -1 for minus
    if (!this.isRunning) return;

    const remainingMs = this.targetTime - performance.now();
    let adjustmentMs = 0;

    if (remainingMs < 60 * 1000) {
      // меньше 1 минуты
      adjustmentMs = 5 * 1000; // +- 5 сек
    } else if (remainingMs < 5 * 60 * 1000) {
      // 1-5 минут
      adjustmentMs = 15 * 1000; // +- 15 сек
    } else if (remainingMs < 15 * 60 * 1000) {
      // 5-15 минут
      adjustmentMs = 30 * 1000; // +- 30 сек
    } else if (remainingMs < 30 * 60 * 1000) {
      // 15-30 минут
      adjustmentMs = 1 * 60 * 1000; // +- 1 мин
    } else if (remainingMs < 60 * 60 * 1000) {
      // 30-60 минут
      adjustmentMs = 5 * 60 * 1000; // +- 5 мин
    } else {
      // 1 час и больше
      adjustmentMs = 15 * 60 * 1000; // +- 15 мин
    }

    this.targetTime += adjustmentMs * direction;
    this.totalDuration += adjustmentMs * direction;

    if (this.targetTime < performance.now()) {
      this.targetTime = performance.now();
    }
    if (this.totalDuration < 0) {
      this.totalDuration = 0;
    }

    sm.vibrate(20);
    this.updateDisplay(this.targetTime - performance.now());
  },
};
