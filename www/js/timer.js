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
import { createRingController } from "./ring/ring-controller.js?v=VERSION";

import { setupTimerRender } from "./timer/timer-render.js?v=VERSION";
import { setupTimerInputs } from "./timer/timer-inputs.js?v=VERSION";
import { setupTimerCore } from "./timer/timer-core.js?v=VERSION";

export const tm = {
  totalDuration: 0,
  initialDurationMs: 0,
  targetEpochMs: 0,
  remainingAtPause: 0,
  isRunning: false,
  isPaused: false,
  isFinished: false,
  timeRemainingMs: 0,

  els: {},
  ringLength: 282.74,
  ringCtrl: null,
  currentAdjustmentSec: 0,

  rAF: null,
  lastUiRem: 0,
  _lastUiPaintTs: 0,
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

  _unbindRuntime: null,

  init() {
    this._unbindRuntime?.();
    this._unbindRuntime = null;

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

      this.ringCtrl?.stop?.();
      this.ringCtrl = createRingController({
        ringEl: this.els.ring,
        initialOffset: this.ringLength,
        alpha: 0.22,
      });
      this.ringCtrl.start();
    }

    setupTimerRender(this, { updateText, updateTitle });
    setupTimerInputs(this, { pad });
    setupTimerCore(this, { showToast, updateText });

    this.bindInputEvents();
    this.bindCoreEvents();

    const disposers = [];
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        this.stopUiLoop?.();
        return;
      }

      if (this.isRunning) {
        const rem = Math.max(0, this.targetEpochMs - Date.now());
        this.timeRemainingMs = rem;
        this.lastUiRem = rem;
        this.updateDisplay(rem);
        this.startUiLoop?.();
        return;
      }

      if (this.isPaused) {
        const rem = Math.max(
          0,
          this.remainingAtPause || this.timeRemainingMs || 0,
        );
        this.timeRemainingMs = rem;
        this.updateDisplay(rem);
        this.updateUIState();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    disposers.push(() =>
      document.removeEventListener("visibilitychange", onVisibilityChange),
    );

    this._unbindRuntime = () => {
      if (this.rAF) {
        cancelAnimationFrame(this.rAF);
        this.rAF = null;
      }

      this._unbindCoreEvents?.();
      this._unbindCoreEvents = null;

      this._unbindInputEvents?.();
      this._unbindInputEvents = null;

      disposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[timer.dispose]", err);
        }
      });
    };
  },
};
