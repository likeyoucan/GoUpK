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
import { modalManager } from "./modal.js?v=VERSION";
import { presets } from "./presets.js?v=VERSION";
import { historyStore } from "./history.js?v=VERSION";
import { uiSettingsManager } from "./ui-settings.js?v=VERSION";

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
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60}m`;
}

function toHms(ms) {
  const totalSec = Math.floor(ms / 1000);
  return {
    h: Math.floor(totalSec / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
  };
}

export const tm = {
  totalDuration: 0,
  targetTime: 0,
  remainingAtPause: 0,
  isRunning: false,
  isPaused: false,
  els: {},
  ringLength: 282.74,
  currentAdjustmentSec: 0,

  startedAt: 0,
  lastPayload: null,

  presetLongPressTimer: null,
  presetLongPressFired: false,
  presetEditId: null,

  getRemainingTime() {
    if (!this.isRunning && !this.isPaused) return 0;
    return timeRemainingMs;
  },

  init() {
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

      // presets UI
      presetsWrap: $("tm-presets-wrap"),
      presetsList: $("tm-presetsList"),
      addPresetBtn: $("tm-addPresetBtn"),

      // preset modal
      presetModalForm: $("tm-preset-modal-content"),
      presetTitle: $("tm-preset-title"),
      presetName: $("tm-preset-name"),
      presetSeconds: $("tm-preset-seconds"),
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
        if (this.els.h.value === "00" || this.els.h.value === "0") {
          this.els.h.value = "";
        }
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
      if (e.data?.type === "tick") {
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

          this._appendHistory("completed");

          sm.vibrate([200, 100, 200, 100, 400], "strong");
          sm.play("complete");
          announceToScreenReader(t("timer_finished"));

          requestAnimationFrame(() => {
            showToast(t("timer_finished"));
            this._handleFinishAction();
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

    this._bindPresetsUI();
    this.renderPresets();
  },

  _appendHistory(resultStatus = "stopped") {
    if (!this.startedAt) return;

    const duration =
      resultStatus === "completed"
        ? this.totalDuration
        : Math.max(0, this.totalDuration - timeRemainingMs);

    historyStore.append({
      mode: "timer",
      startAt: this.startedAt,
      endAt: Date.now(),
      duration,
      resultStatus,
      payload: this.lastPayload || {
        totalDuration: this.totalDuration,
        finishAction: uiSettingsManager.timerFinishAction || "stop",
        restDurationMs: uiSettingsManager.timerRestDurationMs || 30000,
      },
    });
  },

  _bindPresetsUI() {
    presets.ensureDefaultPresets();

    this.els.addPresetBtn?.addEventListener("click", () => {
      this.presetEditId = null;
      if (this.els.presetTitle) this.els.presetTitle.textContent = t("create_new");
      if (this.els.presetName) this.els.presetName.value = "";
      if (this.els.presetSeconds) this.els.presetSeconds.value = "30";
      modalManager.open("tm-preset-modal");
    });

    this.els.presetModalForm?.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = (this.els.presetName?.value || "").trim() || "Preset";
      const sec = parseInt(this.els.presetSeconds?.value || "0", 10);
      const durationMs = Math.max(1, sec) * 1000;

      if (this.presetEditId) {
        presets.updatePreset(this.presetEditId, { name, durationMs });
      } else {
        presets.createPreset({
          name,
          durationMs,
          type: "countdown",
          meta: {},
        });
      }

      this.presetEditId = null;
      this.renderPresets();
      modalManager.closeCurrent();
    });

    const listEl = this.els.presetsList;
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-preset-id]");
      if (!chip || this.presetLongPressFired || this.isRunning) return;

      const list = presets.getTimerPresets();
      const found = list.find((p) => p.id === chip.dataset.presetId);
      if (!found) return;
      presets.applyPresetToTimer(found, this);
    });

    listEl.addEventListener("pointerdown", (e) => {
      const chip = e.target.closest("[data-preset-id]");
      if (!chip) return;

      this.presetLongPressFired = false;
      this.presetLongPressTimer = setTimeout(() => {
        this.presetLongPressFired = true;
        const id = chip.dataset.presetId;
        const list = presets.getTimerPresets();
        const found = list.find((p) => p.id === id);
        if (!found) return;

        this.presetEditId = found.id;
        if (this.els.presetTitle) this.els.presetTitle.textContent = t("edit");
        if (this.els.presetName) this.els.presetName.value = found.name;
        if (this.els.presetSeconds)
          this.els.presetSeconds.value = String(Math.floor(found.durationMs / 1000));

        modalManager.open("tm-preset-modal");
      }, 500);
    });

    const clearLongPress = () => {
      if (this.presetLongPressTimer) {
        clearTimeout(this.presetLongPressTimer);
        this.presetLongPressTimer = null;
      }
      setTimeout(() => {
        this.presetLongPressFired = false;
      }, 0);
    };

    ["pointerup", "pointercancel", "pointerleave"].forEach((evt) => {
      listEl.addEventListener(evt, clearLongPress);
    });

    listEl.addEventListener("contextmenu", (e) => {
      const chip = e.target.closest("[data-preset-id]");
      if (!chip) return;
      e.preventDefault();
      presets.deletePreset(chip.dataset.presetId);
      this.renderPresets();
    });
  },

  renderPresets() {
    const wrap = this.els.presetsWrap;
    const listEl = this.els.presetsList;
    if (!wrap || !listEl) return;

    const canShow = !this.isRunning && !this.isPaused;
    wrap.classList.toggle("hidden", !canShow);
    if (!canShow) return;

    const list = presets.getTimerPresets();
    listEl.replaceChildren();

    list.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.presetId = p.id;
      btn.className =
        "shrink-0 min-h-[36px] px-3 rounded-full text-xs font-bold app-surface app-text border app-border active:scale-95 transition-transform";
      btn.textContent = p.name;
      listEl.appendChild(btn);
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
    sm.vibrate(40, "light");
    sm.play("click");
    sm.unlock();

    if (this.isRunning) {
      store.clearActiveTimer();
      this.isRunning = false;
      this.isPaused = true;
      this.remainingAtPause = timeRemainingMs;
      bgWorker.postMessage({ command: "stop" });
      releaseWakeLock();
      updateTitle("");
      this.updateUIState();
      return;
    }

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
      timeRemainingMs = duration;
    }

    if (duration <= 0) {
      showToast(t("timer_zero"));
      const elToShake = this.els.form || this.els.inputs;
      elToShake.classList.add("animate-shake");
      setTimeout(() => elToShake.classList.remove("animate-shake"), 300);
      return;
    }

    this.startedAt = Date.now();
    this.lastPayload = {
      totalDuration: duration,
      finishAction: uiSettingsManager.timerFinishAction || "stop",
      restDurationMs: uiSettingsManager.timerRest