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
  targetTime: 0,
  remainingAtPause: 0,
  isRunning: false,
  isPaused: false,
  isFinished: false,
  timeRemainingMs: 0,

  lastCompletedDuration: 0,

  els: {},
  ringLength: 282.74,
  currentAdjustmentSec: 0,

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
      resetBtn: $("tm-resetBtn"),
      resetBtnWrap: $("tm-resetBtn-wrap"),
      runAgainBtn: $("tm-runAgainBtn"),
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

    this.updateUIState();
  },
};
