// Файл: www/js/stopwatch.js

import {
  $,
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
import { uiSettingsManager } from "./ui-settings.js?v=VERSION";
import { store } from "./store.js?v=VERSION";
import { shareResults } from "./share-results.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

import { setupStopwatchRender } from "./stopwatch/stopwatch-render.js?v=VERSION";
import { setupStopwatchSessions } from "./stopwatch/stopwatch-sessions.js?v=VERSION";
import { setupStopwatchShareController } from "./stopwatch/stopwatch-share-controller.js?v=VERSION";

const stopwatchModule = {
  startTime: 0,
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
  lastMinuteBeep: 0,
  sortSelect: null,
  pendingShareSession: null,
  shareResults,

  init() {
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

    if (this.els.ring) {
      this.els.ring.style.strokeDasharray = this.ringLength;
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }

    setupStopwatchRender(this);
    setupStopwatchSessions(this);
    setupStopwatchShareController(this);

    this.els.btn?.addEventListener("click", () => this.toggle());
    this.els.lapBtn?.addEventListener("click", () => this.recordLapOrReset());
    this.bindShareButtons();

    document.addEventListener(APP_EVENTS.TIMER_STARTED, (e) => {
      if (e.detail !== "stopwatch" && this.isRunning) this.toggle();
    });

    bgWorker.addEventListener("message", (e) => {
      if (e.data?.type === "heartbeat" && this.isRunning && document.hidden) {
        this.tick(true);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.isRunning) {
        this.lastRender = 0;
        this.tick();
      }
    });

    document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, () => {
      this.onLanguageChangedForSessions();
    });

    document.addEventListener(APP_EVENTS.MS_CHANGED, () => {
      if (!this.isRunning && this.elapsedTime > 0) this.updateDisplay();
      if (this.laps.length > 0) this.reRenderCurrentLaps();
    });

    this.updateSaveButtonVisibility();
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
      this.els.lapBtn.classList.remove("app-surface", "app-text");
      this.els.lapBtn.classList.add("bg-red-500", "text-white", "is-reset");

      announceToScreenReader(
        `${t("stopwatch")} ${t("pause")}. ${formatTime(this.elapsedTime, {
          showMs: false,
          forceHours: this.elapsedTime >= 3600000,
        })}`,
      );
    } else {
      store.activate("stopwatch");
      this.startTime = performance.now() - this.elapsedTime;
      this.lastMinuteBeep = Math.floor(this.elapsedTime / 60000);
      this.isRunning = true;
      this.pauseTime = 0;

      requestWakeLock();
      bgWorker.postMessage({ command: "start" });
      this.tick();

      this.els.status.classList.add("hidden");
      this.els.display.classList.remove("is-go");
      this.els.lapBtn.classList.remove("hidden");

      updateText(this.els.lapBtn, t("lap"));
      this.els.lapBtn.classList.remove("bg-red-500", "text-white", "is-reset");
      this.els.lapBtn.classList.add("app-surface", "app-text");
    }

    this.updateSaveButtonVisibility();
  },

  tick(isBackground = false) {
    if (!this.isRunning) return;

    const now = performance.now();
    this.elapsedTime = now - this.startTime;

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

    if (now - this.lastRender >= 16 || isBackground) {
      if (!isBackground) {
        this.updateDisplay();
      } else {
        updateTitle(
          formatTime(this.elapsedTime, {
            showMs: false,
            forceHours: this.elapsedTime >= 3600000,
          }),
        );
      }
      this.lastRender = now;
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
          prevLatest.classList.remove("bg-black/5", "dark:bg-white/5");
          const splitTimeEl = prevLatest.querySelector(".split-time");
          splitTimeEl?.classList.remove("primary-text");
          splitTimeEl?.classList.add("app-text");
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
      this.laps = [];
      this.pauseTime = 0;
      this.lastMinuteBeep = 0;

      updateText(this.els.display, "GO");
      this.els.display.classList.add("is-go");
      this.els.status.classList.add("hidden");
      this.els.extendedDisplay?.classList.add("hidden");

      if (this.els.ring) this.els.ring.style.strokeDashoffset = this.ringLength;

      this.els.lapBtn.classList.add("hidden");
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
