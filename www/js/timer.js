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

import { setupTimerRender } from "./timer/timer-render.js?v=VERSION";
import { setupTimerInputs } from "./timer/timer-inputs.js?v=VERSION";
import { setupTimerCore } from "./timer/timer-core.js?v=VERSION";

export const tm = {
  totalDuration: 0,
  initialDurationMs: 0,
  targetTime: 0,
  remainingAtPause: 0,
  isRunning: false,
  isPaused: false,
  isFinished: false,
  timeRemainingMs: 0,

  els: {},
  ringLength: 282.74,
  currentAdjustmentSec: 0,
  ringSoftSync: null,

  // Smooth UI loop state
  rAF: null,
  lastUiRem: 0,

  // Ignore stale worker ticks briefly after +/- adjustments
  skipWorkerTickUntil: 0,

  $,
  t,
  sm,
  store,
  bgWorker,
  requestWakeLock,
  releaseWakeLock,
  updateTitle,
  formatTime,
  announceToScreenReader,

  init() {
    this.els = {
      form: $("tm-form"),
      inputs: $("tm-inputs"),
      restartBtn: $("tm-restartBtn"),
      restartBtnWrap: $("tm-restartBtn-wrap"),
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

    setupTimerRender(this, { updateText, updateTitle });
    setupTimerInputs(this, { pad });
    setupTimerCore(this, { showToast, updateText });

    this.bindInputEvents();
    this.bindCoreEvents();

    // On resume from background, prepare short ring soft-sync and restart smooth UI loop.
    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        this.isRunning &&
        this.els?.ring
      ) {
        const currentOffset = parseFloat(this.els.ring.style.strokeDashoffset);
        const now = performance.now();
        this.ringSoftSync = {
          from: Number.isFinite(currentOffset)
            ? currentOffset
            : this.ringLength,
          start: now,
          end: now + 220,
        };

        this.startUiLoop?.();
      }
    });
  },
};
