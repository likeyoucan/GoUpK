// Файл: www/js/stopwatch/stopwatch-controller.js

import {
  $,
  formatTime,
  updateText,
  updateTitle,
  requestWakeLock,
  releaseWakeLock,
  bgWorker,
  announceToScreenReader,
  animateGoEnter,
} from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { uiSettingsManager } from "../ui-settings.js?v=VERSION";
import { store } from "../store.js?v=VERSION";
import { shareResults } from "../share-results.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";

import { createRingController } from "../ring/ring-controller.js?v=VERSION";
import { setupStopwatchRender } from "./stopwatch-render.js?v=VERSION";
import { setupStopwatchSessions } from "./stopwatch-sessions.js?v=VERSION";
import { setupStopwatchShareController } from "./stopwatch-share-controller.js?v=VERSION";

const stopwatchModule = {
  startEpochMs: 0,

  elapsedTime: 0,
  isRunning: false,
  laps: [],
  rAF: null,
  lastRender: 0,
  els: {},
  savedSessions: [],
  currentSort: "date_desc",
  pauseTime: 0,
  nameModalState: { action: null, targetId: null, pendingSession: null },
  ringLength: 282.74,
  ringCtrl: null,
  lastMinuteBeep: 0,
  sortSelect: null,
  pendingShareSession: null,
  pendingLapsRerender: false,
  shareResults,

  _unbindCore: null,
  _unbindSessions: null,
  _unbindShareController: null,

  init() {
    this._unbindCore?.();
    this._unbindCore = null;

    this.els = {
      display: $("sw-mainDisplay"),
      extendedDisplay: $("sw-extendedDisplay"),
      status: $("sw-statusText"),
      btn: $("sw-startStopBtn"),
      lapBtn: $("sw-lapBtn"),
      lapsContainer: $("sw-lapsContainer"),
      ring: $("sw-progressRing"),
      saveBtn: $("sw-saveBtn"),
      shareBtn: $("sw-shareBtn"),
      sessionsList: $("sw-sessionsList"),
      swSortWrapper: $("sw-sort-wrapper"),
      nameTitle: $("sw-name-title"),
      nameInput: $("sw-name-input"),
      nameError: $("sw-name-error"),
      lapFlash: $("sw-lapFlash"),
      currentLapsHeader: $("sw-currentLapsHeader"),
      shareModeTextBtn: $("sw-share-text-btn"),
      shareModeCsvBtn: $("sw-share-csv-btn"),
    };

    if (this.els.lapBtn) {
      this.els.lapBtn.classList.add("main_btn");
      this.els.lapBtn.classList.remove(
        "main_btn_red",
        "is-reset",
        "app-surface",
        "app-text",
        "bg-red-500",
        "text-white",
      );
    }

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

    setupStopwatchRender(this);
    setupStopwatchSessions(this);
    setupStopwatchShareController(this);

    const disposers = [];
    const bind = (el, event, handler, options) => {
      if (!el) return;
      el.addEventListener(event, handler, options);
      disposers.push(() => el.removeEventListener(event, handler, options));
    };

    const onStartStopClick = () => this.toggle();
    bind(this.els.btn, "click", onStartStopClick);

    const onLapClick = () => this.recordLapOrReset();
    bind(this.els.lapBtn, "click", onLapClick);

    this.bindShareButtons();

    const onTimerStarted = (e) => {
      if (e.detail !== "stopwatch" && this.isRunning) this.toggle();
    };
    document.addEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted);
    disposers.push(() =>
      document.removeEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted),
    );

    const onWorkerMessage = (e) => {
      if (e.data?.type === "heartbeat" && this.isRunning && document.hidden) {
        this.tick(true);
      }
    };
    bgWorker.addEventListener("message", onWorkerMessage);
    disposers.push(() =>
      bgWorker.removeEventListener("message", onWorkerMessage),
    );

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && this.isRunning) {
        this.lastRender = 0;
        this.tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    disposers.push(() =>
      document.removeEventListener("visibilitychange", onVisibilityChange),
    );

    const onMsChanged = () => {
      if (!this.isRunning && this.elapsedTime > 0) this.updateDisplay();

      if (this.laps.length === 0) return;

      if (this.isRunning) {
        this.pendingLapsRerender = true;
        return;
      }

      this.reRenderCurrentLaps();
    };
    document.addEventListener(APP_EVENTS.MS_CHANGED, onMsChanged);
    disposers.push(() =>
      document.removeEventListener(APP_EVENTS.MS_CHANGED, onMsChanged),
    );

    this.updateSaveButtonVisibility();

    this._unbindCore = () => {
      if (this.rAF) {
        cancelAnimationFrame(this.rAF);
        this.rAF = null;
      }

      disposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[stopwatch.dispose]", err);
        }
      });

      this._unbindSessions?.();
      this._unbindSessions = null;

      this._unbindShareController?.();
      this._unbindShareController = null;
    };
  },

  toggle() {
    sm.vibrate(40, "light");
    sm.play("click");
    sm.unlock();

    if (this.isRunning) {
      store.clearActiveTimer();
      this.isRunning = false;
      this.pauseTime = Date.now();
      bgWorker.postMessage({ command: "stop" });

      if (this.rAF) cancelAnimationFrame(this.rAF);
      this.rAF = null;

      releaseWakeLock();
      updateTitle("");

      this.els.status.classList.remove("hidden");
      updateText(this.els.lapBtn, t("reset"));

      this.els.lapBtn.classList.remove("main_btn");
      this.els.lapBtn.classList.add("main_btn_red");

      announceToScreenReader(
        `${t("stopwatch")} ${t("pause")}. ${formatTime(this.elapsedTime, {
          showMs: false,
          forceHours: this.elapsedTime >= 3600000,
        })}`,
      );

      if (this.pendingLapsRerender) {
        this.reRenderCurrentLaps();
        this.pendingLapsRerender = false;
      }
    } else {
      store.activate("stopwatch");

      this.startEpochMs = Date.now() - this.elapsedTime;
      this.lastMinuteBeep = Math.floor(this.elapsedTime / 60000);
      this.isRunning = true;
      this.pauseTime = 0;

      requestWakeLock();
      bgWorker.postMessage({ command: "start" });
      requestAnimationFrame(() => this.tick());

      this.els.status.classList.add("hidden");
      this.els.display.classList.remove("is-go");
      this.els.lapBtn.classList.remove("hidden");

      updateText(this.els.lapBtn, t("lap"));

      this.els.lapBtn.classList.remove("main_btn_red");
      this.els.lapBtn.classList.add("main_btn");
    }

    this.updateSaveButtonVisibility();
  },

  tick(isBackground = false) {
    if (!this.isRunning) return;

    this.elapsedTime = Math.max(0, Date.now() - this.startEpochMs);

    const currentMinute = Math.floor(this.elapsedTime / 60000);
    if (
      uiSettingsManager.swMinuteBeep &&
      currentMinute > this.lastMinuteBeep &&
      this.elapsedTime > 1000
    ) {
      this.lastMinuteBeep = currentMinute;
      sm.play("minute_beep");
      sm.vibrate(40, "light");
    }

    const nowPerf = performance.now();
    if (nowPerf - this.lastRender >= 16 || isBackground) {
      if (!isBackground) {
        this.updateDisplay();

        if (this.ringCtrl) {
          const targetOffset =
            this.ringLength -
            ((this.elapsedTime % 60000) / 60000) * this.ringLength;
          this.ringCtrl.setTarget(targetOffset);
        }
      } else {
        updateTitle(
          formatTime(this.elapsedTime, {
            showMs: false,
            forceHours: this.elapsedTime >= 3600000,
          }),
        );
      }

      this.lastRender = nowPerf;
    }

    if (!isBackground) {
      if (this.rAF) cancelAnimationFrame(this.rAF);
      this.rAF = requestAnimationFrame(() => this.tick());
    }
  },

  recordLapOrReset() {
    sm.vibrate(30, "medium");
    sm.play("click");

    if (this.isRunning) {
      const lastLapTotal = this.laps.length > 0 ? this.laps[0].total : 0;
      const diff = this.elapsedTime - lastLapTotal;

      this.laps.unshift({
        total: this.elapsedTime,
        diff,
        index: this.laps.length + 1,
      });

      if (this.laps.length === 1) {
        this.els.lapsContainer.replaceChildren();
        this.els.currentLapsHeader.classList.remove("hidden");
        this.els.currentLapsHeader.classList.add("flex");
      } else {
        const prevLatest = this.els.lapsContainer.firstElementChild;
        if (prevLatest) {
          prevLatest.classList.remove("is-latest");
          const splitTimeEl = prevLatest.querySelector(".split-time");
          splitTimeEl?.classList.remove("split-time-latest");
        }
      }

      this.els.lapsContainer.prepend(this.createLapElement(this.laps[0], true));

      if (this.els.lapFlash) {
        this.els.lapFlash.classList.remove("flash-active");
        void this.els.lapFlash.offsetWidth;
        this.els.lapFlash.classList.add("flash-active");
      }

      this.updateSaveButtonVisibility();
      return;
    }

    if (this.elapsedTime > 0) {
      if (store.isActive("stopwatch")) store.clearActiveTimer();

      this.elapsedTime = 0;
      this.startEpochMs = 0;
      this.laps = [];
      this.pauseTime = 0;
      this.lastMinuteBeep = 0;
      this.pendingLapsRerender = false;

      updateText(this.els.display, "GO");
      this.els.display.classList.add("is-go");
      animateGoEnter(this.els.display);
      this.els.display.style.transform = "";
      this.els.status.classList.add("hidden");
      this.els.extendedDisplay?.classList.add("hidden");

      if (this.ringCtrl) this.ringCtrl.snap(this.ringLength);
      else if (this.els.ring)
        this.els.ring.style.strokeDashoffset = this.ringLength;

      this.els.lapBtn.classList.add("hidden");

      this.els.lapBtn.classList.remove("main_btn_red");
      this.els.lapBtn.classList.add("main_btn");

      this.els.currentLapsHeader.classList.add("hidden");
      this.els.currentLapsHeader.classList.remove("flex");

      const noLapsDiv = document.createElement("div");
      noLapsDiv.className = "text-center app-text-sec opacity-50 mt-4 text-sm";
      noLapsDiv.setAttribute("data-i18n", "no_laps");
      noLapsDiv.textContent = t("no_laps");
      this.els.lapsContainer.replaceChildren(noLapsDiv);

      this.updateSaveButtonVisibility();
    }
  },
};

export const sw = stopwatchModule;
