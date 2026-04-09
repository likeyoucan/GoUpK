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
} from "./utils.js";
import { sm } from "./sound.js";
import { t } from "./i18n.js";

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
      circleBtn: $("tm-circleBtn"),
      status: $("tm-statusText"),
      display: $("tm-mainDisplay"),
      ring: $("tm-progressRing"),
      h: $("tm-h"),
      m: $("tm-m"),
      s: $("tm-s"),
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
    let isDragging = false;
    const threshold = 15;

    const updateVal = (delta) => {
      let val = parseInt(input.value || 0, 10);
      val += delta;
      if (isWrap) {
        if (val > max) val = 0;
        if (val < 0) val = max;
      } else {
        if (val > max) val = max;
        if (val < 0) val = 0;
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
      { passive: false }
    );

    input.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches[0].clientY;
      },
      { passive: true }
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
      { passive: false }
    );

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
        new CustomEvent("timerStarted", { detail: "timer" })
      );

      if (!this.isPaused) {
        const h = parseInt(this.els.h.value, 10) || 0;
        const m = parseInt(this.els.m.value, 10) || 0;
        const s = parseInt(this.els.s.value, 10) || 0;
        this.totalDuration = (h * 3600 + m * 60 + s) * 1000;

        if (this.totalDuration === 0) {
          showToast(t("timer_zero"));
          this.els.inputs.classList.add("animate-shake");
          setTimeout(
            () => this.els.inputs.classList.remove("animate-shake"),
            300
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
    this.els.ring.style.strokeDashoffset = this.ringLength;
    updateText(this.els.display, "GO");
    this.els.display.classList.add("is-go");
  },

  updateUIState() {
    if (this.isRunning) {
      this.els.inputs.classList.add("hidden", "opacity-0");
      this.els.resetBtn.classList.add("hidden");
      this.els.status.classList.add("hidden");
      this.els.display.classList.remove("is-go");
    } else if (this.isPaused) {
      this.els.inputs.classList.add("hidden", "opacity-0");
      this.els.resetBtn.classList.remove("hidden");
      this.els.status.classList.remove("hidden");
      updateText(this.els.status, t("pause"));
    } else {
      this.els.inputs.classList.remove("hidden", "opacity-0");
      this.els.resetBtn.classList.add("hidden");
      this.els.status.classList.add("hidden");
      this.els.display.classList.add("is-go");
      updateText(this.els.display, "GO");
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

    if (!isBackground) this.rAF = requestAnimationFrame(() => this.tick());
  },

  getFormattedTime(sTotal) {
    const h = Math.floor(sTotal / 3600);
    const m = Math.floor((sTotal % 3600) / 60);
    const s = sTotal % 60;
    const hInput = parseInt(this.els.h.value, 10) || 0;
    const mInput = parseInt(this.els.m.value, 10) || 0;
    if (hInput > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (mInput > 0 || m > 0) return `${pad(m)}:${pad(s)}`;
    return `${s}`;
  },

  updateDisplay(rem) {
    const sTotal = Math.ceil(rem / 1000);
    const timeStr = this.getFormattedTime(sTotal);

    updateText(this.els.display, timeStr);
    updateTitle(timeStr);
    this.els.ring.style.strokeDashoffset =
      this.ringLength -
      (Math.max(0, this.totalDuration - rem) / this.totalDuration) *
        this.ringLength;
  },
};
