// Файл: js/stopwatch.js

import {
  $,
  formatTime,
  updateText,
  updateTitle,
  requestWakeLock,
  releaseWakeLock,
  bgWorker,
  safeSetLS,
  safeGetLS,
  safeRemoveLS,
  announceToScreenReader,
  showToast,
} from "./utils.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { store } from "./store.js?v=VERSION";

// Создаем объект-модуль
const stopwatchModule = {
  // --- Свойства объекта ---
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

  // --- Основной метод инициализации ---
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
      sessionsList: $("sw-sessionsList"),
      sortSelect: $("sw-sortSelect"),
      nameTitle: $("sw-name-title"),
      nameInput: $("sw-name-input"),
      nameError: $("sw-name-error"),
      lapFlash: $("sw-lapFlash"),
      currentLapsHeader: $("sw-currentLapsHeader"),
    };

    if (this.els.ring) {
      this.els.ring.style.strokeDasharray = this.ringLength;
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }

    this.els.btn?.addEventListener("click", () => this.toggle());
    this.els.lapBtn?.addEventListener("click", () => this.recordLapOrReset());
    this.els.saveBtn?.addEventListener("click", () =>
      this.prepareSaveSession(),
    );
    this.els.sortSelect?.addEventListener("change", (e) =>
      this.sortSessions(e.target.value),
    );
    this.els.nameInput?.addEventListener("input", () =>
      this.els.nameError?.classList.add("hidden"),
    );
    this.els.sessionsList?.addEventListener("click", (e) => {
      const header = e.target.closest(".sw-session-header");
      const renameBtn = e.target.closest(".sw-rename-btn");
      const deleteBtn = e.target.closest(".sw-delete-btn");
      if (renameBtn) {
        e.stopPropagation();
        this.prepareRenameSession(Number(renameBtn.dataset.id));
      } else if (deleteBtn) {
        e.stopPropagation();
        this.deleteSession(Number(deleteBtn.dataset.id));
      } else if (header) {
        this.toggleSessionDetails(Number(header.dataset.id));
      }
    });

    document.addEventListener("timerStarted", (e) => {
      if (e.detail !== "stopwatch" && this.isRunning) this.toggle();
    });
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

    try {
      const stored = safeGetLS("sw_saved_sessions");
      this.savedSessions = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.savedSessions = [];
    }

    document.addEventListener("languageChanged", () => {
      this.renderSavedSessions();
      if (this.laps.length > 0) this.reRenderCurrentLaps();
    });
    document.addEventListener("msChanged", () => {
      if (!this.isRunning && this.elapsedTime > 0) this.updateDisplay();
      if (this.laps.length > 0) this.reRenderCurrentLaps();
    });
  },

  formatTime(ms, forceMs = null) {
    const showMilliseconds = forceMs !== null ? forceMs : themeManager.showMs;
    const shouldForceHours = this.elapsedTime >= 3600000;
    return formatTime(ms, {
      showMs: showMilliseconds,
      forceHours: shouldForceHours,
    });
  },

  getUniqueName(baseName) {
    let name = baseName,
      counter = 1;
    const exists = (n) =>
      this.savedSessions.some((s) => s.name.toLowerCase() === n.toLowerCase());
    while (exists(name)) {
      name = `${baseName} ${counter++}`;
    }
    return name;
  },

  toggle() {
    sm.vibrate(50);
    sm.play("click");
    sm.unlock();

    if (this.isRunning) {
      store.clearActiveTimer();
      this.isRunning = false;
      this.pauseTime = Date.now();
      bgWorker.postMessage("stop");
      cancelAnimationFrame(this.rAF);
      releaseWakeLock();
      updateTitle("");
      this.els.status.classList.remove("hidden");
      updateText(this.els.lapBtn, t("reset"));
      this.els.lapBtn.classList.remove("app-surface", "app-text");
      this.els.lapBtn.classList.add("bg-red-500", "text-white", "is-reset");
      announceToScreenReader(
        `${t("stopwatch")} ${t("pause")}. ${this.formatTime(this.elapsedTime, false)}`,
      );
    } else {
      document.dispatchEvent(
        new CustomEvent("timerStarted", { detail: "stopwatch" }),
      );
      store.setActiveTimer("stopwatch");
      this.startTime = performance.now() - this.elapsedTime;
      this.isRunning = true;
      this.pauseTime = 0;
      requestWakeLock();
      bgWorker.postMessage("start");
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
    if (now - this.lastRender >= 16 || isBackground) {
      if (!isBackground) this.updateDisplay();
      else updateTitle(this.formatTime(this.elapsedTime, false));
      this.lastRender = now;
    }
    if (!isBackground) {
      cancelAnimationFrame(this.rAF);
      this.rAF = requestAnimationFrame(() => this.tick());
    }
  },

  updateDisplay() {
    const showMs = themeManager.showMs;
    const shouldForceHours = this.elapsedTime >= 3600000;

    const mainDisplayParts = formatTime(this.elapsedTime, { showMs }).split(
      ":",
    );
    const mainDisplayStr = shouldForceHours
      ? mainDisplayParts.join(":")
      : mainDisplayParts.slice(-2).join(":");
    updateText(this.els.display, mainDisplayStr);

    if (this.els.extendedDisplay) {
      const extStr = formatTime(this.elapsedTime, {
        showDays: true,
        daySuffix: t("day_short"),
        hourSuffix: t("hour_short"),
      });
      if (extStr) {
        updateText(this.els.extendedDisplay, extStr);
        this.els.extendedDisplay.classList.remove("hidden");
      } else {
        this.els.extendedDisplay.classList.add("hidden");
      }
    }
    updateTitle(this.formatTime(this.elapsedTime, false));
    if (this.els.ring)
      this.els.ring.style.strokeDashoffset =
        this.ringLength -
        ((this.elapsedTime % 60000) / 60000) * this.ringLength;
  },

  recordLapOrReset() {
    sm.vibrate(30);
    sm.play("click");
    if (this.isRunning) {
      const diff =
        this.elapsedTime - (this.laps.length > 0 ? this.laps[0].total : 0);
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
    } else if (this.elapsedTime > 0) {
      if (store.isActive("stopwatch")) store.clearActiveTimer();
      this.elapsedTime = 0;
      this.laps = [];
      this.pauseTime = 0;
      updateText(this.els.display, "GO");
      this.els.display.classList.add("is-go");
      this.els.status.classList.add("hidden");
      this.els.extendedDisplay?.classList.add("hidden");
      if (this.els.ring) this.els.ring.style.strokeDashoffset = this.ringLength;
      this.els.lapBtn.classList.add("hidden");
      this.els.currentLapsHeader.classList.add("hidden");
      this.els.currentLapsHeader.classList.remove("flex");
      this.els.lapsContainer.replaceChildren();
      this.els.lapsContainer.insertAdjacentHTML(
        "afterbegin",
        `<div class="text-center app-text-sec opacity-50 mt-4 text-sm" data-i18n="no_laps">${t("no_laps")}</div>`,
      );
      this.updateSaveButtonVisibility();
    }
  },

  createLapElement(lap, isLatest = false) {
    const lapTemplate = $("sw-lap-row-template");
    if (!lapTemplate) return document.createElement("div");

    const clone = lapTemplate.content.cloneNode(true);
    const div = clone.firstElementChild;

    div.classList.add(
      "lap-row",
      "mt-2.5",
      "py-3",
      "border-b",
      "app-border",
      "px-3",
      "rounded-lg",
      "transition-all",
      "duration-300",
    );
    div.classList.remove("py-2", "border-gray-500/10", "px-2");
    if (isLatest) div.classList.add("bg-black/5", "dark:bg-white/5");

    const shouldForceHours = this.elapsedTime >= 3600000;

    div.querySelector('[data-template="lap-index"]').textContent =
      `${t("lap_text")} ${lap.index}`;
    div.querySelector('[data-template="lap-total"]').textContent = formatTime(
      lap.total,
      { showMs: true, forceHours: shouldForceHours },
    );

    const splitTimeEl = div.querySelector('[data-template="lap-split"]');
    splitTimeEl.textContent = formatTime(lap.diff, {
      showMs: true,
      forceHours: shouldForceHours,
    });
    splitTimeEl.classList.add("split-time");

    if (isLatest) {
      splitTimeEl.classList.remove("app-text");
      splitTimeEl.classList.add("primary-text");
    }

    return div;
  },

  reRenderCurrentLaps() {
    this.els.lapsContainer.replaceChildren();
    [...this.laps].reverse().forEach((lap, i, arr) => {
      this.els.lapsContainer.prepend(
        this.createLapElement(lap, i === arr.length - 1),
      );
    });
  },

  updateSaveButtonVisibility() {
    if (!this.els.saveBtn) return;
    if (this.laps.length > 0) {
      this.els.saveBtn.classList.remove("hidden");
      this.els.saveBtn.classList.add("flex");
    } else {
      this.els.saveBtn.classList.add("hidden");
      this.els.saveBtn.classList.remove("flex");
    }
  },

  prepareSaveSession() {
    if (this.laps.length === 0 && this.elapsedTime === 0) return;
    let sessionLaps = [...this.laps];
    let total = this.laps.length > 0 ? this.laps[0].total : 0;
    if (this.elapsedTime > total) {
      const diff = this.elapsedTime - total;
      if (diff > 10)
        sessionLaps.unshift({
          total: this.elapsedTime,
          diff,
          index: sessionLaps.length + 1,
        });
    }
    const defaultName = this.getUniqueName(t("stopwatch"));
    const completionTime = this.isRunning
      ? Date.now()
      : this.pauseTime || Date.now();
    const pendingSession = {
      id: Date.now(),
      name: "",
      date: completionTime,
      totalTime: this.elapsedTime,
      laps: sessionLaps,
    };
    modalManager.open("sw-name-modal", {
      action: "save",
      name: defaultName,
      pendingSession,
    });
  },

  prepareRenameSession(id) {
    const session = this.savedSessions.find((s) => s.id === id);
    if (!session) return;
    modalManager.open("sw-name-modal", {
      action: "rename",
      name: session.name,
      targetId: id,
    });
  },

  prepareNameForm(data) {
    this.nameModalState = { ...data };
    this.els.nameError?.classList.add("hidden");
    updateText(
      this.els.nameTitle,
      data.action === "rename" ? t("rename") : t("session_name"),
    );
    this.els.nameInput.value = data.name;
    this.els.nameInput.placeholder = data.name;
    setTimeout(() => this.els.nameInput?.focus(), 100);
  },

  confirmNameModal() {
    const inputVal = this.els.nameInput.value.trim();
    const finalName =
      inputVal !== "" ? inputVal : this.els.nameInput.placeholder;
    const isDuplicate = this.savedSessions.some(
      (s) =>
        s.name.toLowerCase() === finalName.toLowerCase() &&
        (this.nameModalState.action === "save" ||
          s.id !== this.nameModalState.targetId),
    );
    if (isDuplicate) {
      this.els.nameError?.classList.remove("hidden");
      this.els.nameInput.classList.add("animate-shake");
      setTimeout(
        () => this.els.nameInput.classList.remove("animate-shake"),
        300,
      );
      return;
    }
    if (this.nameModalState.action === "save") {
      const session = this.nameModalState.pendingSession;
      session.name = finalName;
      this.savedSessions.push(session);
      safeSetLS("sw_saved_sessions", JSON.stringify(this.savedSessions));
      showToast(t("session_saved"));
    } else if (this.nameModalState.action === "rename") {
      const session = this.savedSessions.find(
        (s) => s.id === this.nameModalState.targetId,
      );
      if (session) {
        session.name = finalName;
        safeSetLS("sw_saved_sessions", JSON.stringify(this.savedSessions));
        this.sortSessions(this.currentSort);
      }
    }
    modalManager.closeCurrent();
  },

  confirmClearAll() {
    this.savedSessions = [];
    safeRemoveLS("sw_saved_sessions");
    this.renderSavedSessions();
    modalManager.closeCurrent();
    showToast(t("history_cleared"));
  },

  sortSessions(type) {
    this.currentSort = type;
    if (this.els.sortSelect) this.els.sortSelect.value = type;
    this.savedSessions.sort((a, b) => {
      if (type === "date_desc") return b.date - a.date;
      if (type === "date_asc") return a.date - b.date;
      if (type === "name_az") return a.name.localeCompare(b.name);
      if (type === "name_za") return b.name.localeCompare(a.name);
      if (type === "result_fast") return a.totalTime - b.totalTime;
      return 0;
    });
    this.renderSavedSessions();
  },

  deleteSession(id) {
    this.savedSessions = this.savedSessions.filter((s) => s.id !== id);
    safeSetLS("sw_saved_sessions", JSON.stringify(this.savedSessions));
    this.renderSavedSessions();
  },

  toggleSessionDetails(id) {
    const detailsEl = $(`sw-details-${id}`);
    const iconEl = $(`sw-icon-${id}`);
    if (!detailsEl) return;
    if (detailsEl.classList.contains("hidden")) {
      detailsEl.classList.remove("hidden");
      if (iconEl) iconEl.style.transform = "rotate(180deg)";
    } else {
      detailsEl.classList.add("hidden");
      if (iconEl) iconEl.style.transform = "rotate(0deg)";
    }
  },

  renderSavedSessions() {
    if (!this.els || !this.els.sessionsList) return;
    this.els.sessionsList.replaceChildren();
    const clearAllBtn = $("sw-clearAllBtn");
    if (clearAllBtn) clearAllBtn.disabled = this.savedSessions.length === 0;
    if (this.savedSessions.length === 0) {
      this.els.sessionsList.insertAdjacentHTML(
        "afterbegin",
        `<div class="text-center app-text-sec opacity-50 mt-10 text-sm pointer-events-none" data-i18n="empty_sessions">${t("empty_sessions")}</div>`,
      );
      return;
    }
    const fragment = document.createDocumentFragment();
    const sessionTemplate = $("sw-session-template");
    const lapTemplate = $("sw-lap-row-template");
    if (!sessionTemplate || !lapTemplate) return;

    this.savedSessions.forEach((session) => {
      const clone = sessionTemplate.content.cloneNode(true);
      const sessionElement = clone.firstElementChild;
      const shouldForceHours = session.totalTime >= 3600000;
      const dateObj = new Date(session.date || session.id);
      const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

      sessionElement.querySelector('[data-template="name"]').textContent =
        session.name;
      sessionElement.querySelector('[data-template="date"]').textContent =
        dateStr;
      sessionElement.querySelector('[data-template="totalTime"]').textContent =
        formatTime(session.totalTime, {
          showMs: true,
          forceHours: shouldForceHours,
        });

      sessionElement.querySelector('[data-template-id="header"]').dataset.id =
        session.id;
      sessionElement.querySelector(
        '[data-template-id="renameBtn"]',
      ).dataset.id = session.id;
      sessionElement.querySelector(
        '[data-template-id="deleteBtn"]',
      ).dataset.id = session.id;

      const detailsEl = sessionElement.querySelector(
        '[data-template-id="details"]',
      );
      const iconEl = sessionElement.querySelector('[data-template-id="icon"]');
      detailsEl.id = `sw-details-${session.id}`;
      iconEl.id = `sw-icon-${session.id}`;

      sessionElement.querySelector(
        '[data-template-id="renameBtn"]',
      ).textContent = t("rename");
      sessionElement.querySelector(
        '[data-template-id="deleteBtn"]',
      ).textContent = t("delete");

      const lapsContainer = sessionElement.querySelector(
        '[data-template="lapsContainer"]',
      );
      const headerDiv = document.createElement("div");
      headerDiv.className =
        "flex justify-between items-center py-1.5 border-b border-gray-500/30 mb-1 px-2";
      headerDiv.innerHTML = `<span class="text-[10px] font-bold app-text-sec uppercase tracking-wider">${t("lap_text")}</span><div class="flex items-center gap-4"><span class="text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right">${t("total_time")}</span><span class="text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right">${t("split_time")}</span></div>`;
      lapsContainer.appendChild(headerDiv);

      session.laps.forEach((lap) => {
        const lapClone = lapTemplate.content.cloneNode(true);
        const lapElement = lapClone.firstElementChild;

        lapElement.querySelector('[data-template="lap-index"]').textContent =
          `${t("lap_text")} ${lap.index}`;
        lapElement.querySelector('[data-template="lap-total"]').textContent =
          formatTime(lap.total, { showMs: true, forceHours: shouldForceHours });
        lapElement.querySelector('[data-template="lap-split"]').textContent =
          formatTime(lap.diff, { showMs: true, forceHours: shouldForceHours });

        lapsContainer.appendChild(lapElement);
      });

      fragment.appendChild(sessionElement);
    });
    this.els.sessionsList.appendChild(fragment);
  },
};

export const sw = stopwatchModule;
