import {
  $,
  escapeHTML,
  showToast,
  formatMsTime,
  formatMainDisplay,
  getExtendedDisplay,
  updateText,
  updateTitle,
  requestWakeLock,
  releaseWakeLock,
  bgWorker,
  safeSetLS,
  safeGetLS,
  safeRemoveLS,
  announceToScreenReader,
} from "./utils.js";
import { sm } from "./sound.js";
import { t } from "./i18n.js";
import { themeManager } from "./theme.js";
import { createModal } from "./modal.js";

// Создаем экземпляры модальных окон
const sessionsModal = createModal("template-sw-sessions-modal");
const nameModal = createModal("template-sw-name-modal");
const clearModal = createModal("template-sw-clear-modal");

export const sw = {
  closeTimeoutId: null,
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

  init() {
    // Кешируем только те элементы, которые всегда есть в DOM
    this.els = {
      display: $("sw-mainDisplay"),
      extendedDisplay: $("sw-extendedDisplay"),
      status: $("sw-statusText"),
      btn: $("sw-startStopBtn"),
      lapBtn: $("sw-lapBtn"),
      lapsContainer: $("sw-lapsContainer"),
      ring: $("sw-progressRing"),
      saveBtn: $("sw-saveBtn"),
      openResultsBtn: $("sw-openResultsBtn"),
      lapFlash: $("sw-lapFlash"),
      currentLapsHeader: $("sw-currentLapsHeader"),
    };
    if (this.els.ring) {
      this.els.ring.style.strokeDasharray = this.ringLength;
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }

    this.setupEventListeners();

    try {
      const stored = safeGetLS("sw_saved_sessions");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.savedSessions = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      this.savedSessions = [];
    }
  },

  setupEventListeners() {
    document.addEventListener("timerStarted", (e) => {
      if (e.detail !== "stopwatch" && this.isRunning) this.toggle();
    });

    bgWorker.addEventListener("message", (e) => {
      if (
        e.data.type === "heartbeat:tick" &&
        this.isRunning &&
        document.hidden
      ) {
        this.tick(true);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.isRunning) {
        this.lastRender = 0;
        this.tick();
      }
    });

    this.els.btn?.addEventListener("click", () => this.toggle());
    this.els.lapBtn?.addEventListener("click", () => this.recordLapOrReset());
    this.els.saveBtn?.addEventListener("click", () =>
      this.prepareSaveSession(),
    );
    this.els.openResultsBtn?.addEventListener("click", () => this.openModal());

    document.addEventListener("languageChanged", () => this.updateUIText());
    document.addEventListener("msChanged", () => {
      if (!this.isRunning && this.elapsedTime > 0) this.updateDisplay();
      if (this.laps.length > 0) this.reRenderCurrentLaps();
    });

    // Делегированные слушатели для модальных окон
    document.body.addEventListener("click", (e) => {
      if (e.target.id === "sw-closeResultsBtn") this.closeModal();
      if (e.target.id === "sw-clearAllBtn" && this.savedSessions.length > 0)
        this.openClearModal();
      if (e.target.id === "sw-clear-cancel") this.closeClearModal();
      if (e.target.id === "sw-clear-confirm") this.confirmClearAll();
      if (e.target.id === "sw-name-cancel") this.closeNameModal();

      const sessionsList = e.target.closest("#sw-sessionsList");
      if (sessionsList) {
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
      }
    });

    document.body.addEventListener("change", (e) => {
      if (e.target.id === "sw-sortSelect") this.sortSessions(e.target.value);
    });

    document.body.addEventListener("input", (e) => {
      if (e.target.id === "sw-name-input")
        $("sw-name-error")?.classList.add("hidden");
    });
  },

  formatTime(ms, forceMs = null) {
    const showMs = forceMs !== null ? forceMs : themeManager.showMs;
    return formatMsTime(ms, showMs);
  },

  getUniqueName(baseName) {
    let name = baseName;
    let counter = 1;
    const exists = (n) =>
      this.savedSessions.some((s) => s.name.toLowerCase() === n.toLowerCase());
    while (exists(name)) {
      name = `${baseName} ${counter}`;
      counter++;
    }
    return name;
  },

  toggle() {
    sm.vibrate(50);
    sm.play("click");
    sm.unlock();
    if (this.isRunning) {
      this.isRunning = false;
      this.pauseTime = Date.now();
      bgWorker.postMessage({ command: "stop" });
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
      this.startTime = performance.now() - this.elapsedTime;
      this.isRunning = true;
      this.pauseTime = 0;
      requestWakeLock();
      bgWorker.postMessage({ command: "start", mode: "heartbeat" });
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
      if (!isBackground) {
        this.updateDisplay();
      } else {
        updateTitle(this.formatTime(this.elapsedTime, false));
      }
      this.lastRender = now;
    }
    if (!isBackground) {
      cancelAnimationFrame(this.rAF);
      this.rAF = requestAnimationFrame(() => this.tick());
    }
  },

  updateDisplay() {
    const showMs = themeManager.showMs;
    const timeStr = formatMainDisplay(this.elapsedTime, showMs);
    updateText(this.els.display, timeStr);
    if (this.els.extendedDisplay) {
      const extStr = getExtendedDisplay(
        this.elapsedTime,
        t("day_short"),
        t("hour_short"),
      );
      if (extStr) {
        updateText(this.els.extendedDisplay, extStr);
        this.els.extendedDisplay.classList.remove("hidden");
      } else {
        this.els.extendedDisplay.classList.add("hidden");
      }
    }
    updateTitle(this.formatTime(this.elapsedTime, false));
    if (this.els.ring) {
      this.els.ring.style.strokeDashoffset =
        this.ringLength -
        ((this.elapsedTime % 60000) / 60000) * this.ringLength;
    }
  },

  recordLapOrReset() {
    sm.vibrate(30);
    sm.play("click");
    if (this.isRunning) {
      const diff =
        this.elapsedTime - (this.laps.length > 0 ? this.laps[0].total : 0);
      const newLap = {
        total: this.elapsedTime,
        diff: diff,
        index: this.laps.length + 1,
      };
      this.laps.unshift(newLap);

      if (this.laps.length === 1) {
        this.els.lapsContainer.replaceChildren();
        this.els.currentLapsHeader.classList.remove("hidden");
        this.els.currentLapsHeader.classList.add("flex");
      }

      const prevLatest = this.els.lapsContainer.querySelector(".lap-row");
      if (prevLatest) {
        prevLatest.classList.remove("bg-black/5", "dark:bg-white/5");
        const prevTime = prevLatest.querySelector(".split-time");
        if (prevTime) {
          prevTime.classList.remove("primary-text");
          prevTime.classList.add("app-text");
        }
      }

      const lapRow = document.createElement("div");
      lapRow.className =
        "lap-row mt-2.5 flex justify-between items-center py-3 border-b app-border px-3 rounded-lg transition-all duration-300 bg-black/5 dark:bg-white/5";
      lapRow.dataset.lapIndex = newLap.index;
      lapRow.innerHTML = `
            <span class="lap-index-text text-xs app-text-sec font-medium">${t("lap_text")} ${newLap.index}</span>
            <div class="flex items-center gap-4">
                <span class="lap-total-time font-mono text-[10px] app-text-sec opacity-60 w-16 text-right">${this.formatTime(newLap.total, true)}</span>
                <span class="split-time font-mono text-xs font-bold primary-text w-16 text-right">${this.formatTime(newLap.diff, true)}</span>
            </div>
        `;
      this.els.lapsContainer.prepend(lapRow);

      if (this.els.lapFlash) {
        this.els.lapFlash.classList.remove("flash-active");
        void this.els.lapFlash.offsetWidth;
        this.els.lapFlash.classList.add("flash-active");
      }
      this.updateSaveButtonVisibility();
    } else if (this.elapsedTime > 0) {
      this.elapsedTime = 0;
      this.laps = [];
      this.pauseTime = 0;
      updateText(this.els.display, "GO");
      this.els.display.classList.add("is-go");
      this.els.status.classList.add("hidden");
      this.els.extendedDisplay?.classList.add("hidden");
      if (this.els.ring) {
        this.els.ring.style.strokeDashoffset = this.ringLength;
      }
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

  reRenderCurrentLaps() {
    const header = this.els.currentLapsHeader;
    if (header) {
      header.querySelector('[data-i18n="lap_text"]').textContent =
        t("lap_text");
      header.querySelector('[data-i18n="total_time"]').textContent =
        t("total_time");
      header.querySelector('[data-i18n="split_time"]').textContent =
        t("split_time");
    }
    this.els.lapsContainer.querySelectorAll(".lap-row").forEach((row) => {
      const index = row.dataset.lapIndex;
      if (!index) return;
      const lapData = this.laps.find((lap) => lap.index == index);
      if (!lapData) return;
      updateText(
        row.querySelector(".lap-index-text"),
        `${t("lap_text")} ${lapData.index}`,
      );
      updateText(
        row.querySelector(".lap-total-time"),
        this.formatTime(lapData.total, true),
      );
      updateText(
        row.querySelector(".split-time"),
        this.formatTime(lapData.diff, true),
      );
    });
  },

  updateUIText() {
    if (this.laps.length > 0) {
      this.reRenderCurrentLaps();
    } else {
      const noLapsEl = this.els.lapsContainer.querySelector(
        '[data-i18n="no_laps"]',
      );
      if (noLapsEl) updateText(noLapsEl, t("no_laps"));
    }
    const sessionsList = $("sw-sessionsList");
    if (!sessionsList) return;
    sessionsList
      .querySelectorAll("[data-i18n-text]")
      .forEach((el) => updateText(el, t(el.getAttribute("data-i18n-text"))));
    const emptyEl = sessionsList.querySelector(".text-center");
    if (emptyEl && this.savedSessions.length === 0)
      updateText(emptyEl, t("empty_sessions"));
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
      if (diff > 10) {
        sessionLaps.unshift({
          total: this.elapsedTime,
          diff: diff,
          index: sessionLaps.length + 1,
        });
      }
    }
    const defaultName = this.getUniqueName(t("stopwatch"));
    const completionTime = this.isRunning
      ? Date.now()
      : this.pauseTime || Date.now();
    this.nameModalState.pendingSession = {
      id: Date.now(),
      name: "",
      date: completionTime,
      totalTime: this.elapsedTime,
      laps: sessionLaps,
    };
    this.openNameModal("save", defaultName);
  },

  prepareRenameSession(id) {
    const session = this.savedSessions.find((s) => s.id === id);
    if (!session) return;
    this.openNameModal("rename", session.name, id);
  },

  openNameModal(action, defaultName, targetId = null) {
    nameModal.open();
    setTimeout(() => {
      this.nameModalState.action = action;
      this.nameModalState.targetId = targetId;
      $("sw-name-error")?.classList.add("hidden");
      updateText(
        $("sw-name-title"),
        action === "rename" ? t("rename") : t("save_session"),
      );
      $("sw-name-input").value = defaultName;
      $("sw-name-input")?.focus();
    }, 0);
  },

  closeNameModal() {
    nameModal.close();
    setTimeout(() => {
      this.nameModalState = {
        action: null,
        targetId: null,
        pendingSession: null,
      };
    }, 300);
  },

  confirmNameModal() {
    const nameInput = $("sw-name-input");
    const inputVal = nameInput.value.trim();
    const finalName = inputVal !== "" ? inputVal : nameInput.placeholder;
    const isDuplicate = this.savedSessions.some(
      (s) =>
        s.name.toLowerCase() === finalName.toLowerCase() &&
        (this.nameModalState.action === "save" ||
          s.id !== this.nameModalState.targetId),
    );
    if (isDuplicate) {
      $("sw-name-error")?.classList.remove("hidden");
      nameInput.classList.add("animate-shake");
      setTimeout(() => nameInput.classList.remove("animate-shake"), 300);
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
    this.closeNameModal();
  },

  openClearModal() {
    if (this.savedSessions.length > 0) clearModal.open();
  },
  closeClearModal() {
    clearModal.close();
  },
  confirmClearAll() {
    this.savedSessions = [];
    safeRemoveLS("sw_saved_sessions");
    this.renderSavedSessions();
    this.closeClearModal();
    showToast(t("history_cleared"));
  },

  openModal() {
    sessionsModal.open();
    this.sortSessions(this.currentSort);
  },
  closeModal() {
    sessionsModal.close();
  },

  sortSessions(type) {
    this.currentSort = type;
    const sortSelect = $("sw-sortSelect");
    if (sortSelect) sortSelect.value = type;
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
    const listEl = $("sw-sessionsList");
    if (!listEl) return;

    listEl.replaceChildren();

    const clearAllBtn = $("sw-clearAllBtn");
    if (clearAllBtn) clearAllBtn.disabled = this.savedSessions.length === 0;

    if (this.savedSessions.length === 0) {
      listEl.innerHTML = `<div class="text-center app-text-sec opacity-50 mt-10 text-sm">${t("empty_sessions")}</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.savedSessions.forEach((session) => {
      const sessionDiv = document.createElement("div");
      sessionDiv.className =
        "app-surface border app-border rounded-xl overflow-hidden transition-all mb-3";
      const dateObj = new Date(session.date || session.id);
      const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

      sessionDiv.innerHTML = `
        <div class="p-4 cursor-pointer flex justify-between items-center active:bg-gray-500/10 sw-session-header" data-id="${session.id}">
            <div class="flex-1 min-w-0 pr-4">
                <div class="font-bold app-text text-lg truncate">${escapeHTML(session.name)}</div>
                <div class="text-xs app-text-sec mt-1">${dateStr}</div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
                <div class="font-mono font-bold primary-text text-lg">${this.formatTime(session.totalTime, true)}</div>
                <svg focusable="false" aria-hidden="true" id="sw-icon-${session.id}" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
        <div id="sw-details-${session.id}" class="hidden bg-black/5 dark:bg-black/20 border-t app-border p-4">
            <div class="flex justify-end gap-2 mb-3">
                <button type="button" data-id="${session.id}" class="sw-rename-btn px-3 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-transform" data-i18n-text="rename">${t("rename")}</button>
                <button type="button" data-id="${session.id}" class="sw-delete-btn px-3 py-1 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-transform" data-i18n-text="delete">${t("delete")}</button>
            </div>
            <div class="max-h-48 overflow-y-auto no-scrollbar bg-black/5 dark:bg-white/5 rounded-lg p-2 border app-border">
                <div class="laps-list-container"></div>
            </div>
        </div>
      `;

      const lapsContainer = sessionDiv.querySelector(".laps-list-container");
      const lapsFragment = document.createDocumentFragment();

      const header = document.createElement("div");
      header.className =
        "flex justify-between items-center py-1.5 border-b border-gray-500/30 mb-1 px-2";
      header.innerHTML = `<span class="text-[10px] font-bold app-text-sec uppercase tracking-wider">${t("lap_text")}</span><div class="flex items-center gap-4"><span class="text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right">${t("total_time")}</span><span class="text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right">${t("split_time")}</span></div>`;
      lapsFragment.appendChild(header);

      session.laps.forEach((lap, idx) => {
        const lapRow = document.createElement("div");
        const isLatest = idx === 0;
        lapRow.className = `flex justify-between items-center py-2 border-b border-gray-500/10 last:border-0 px-2 ${isLatest ? "bg-black/5 dark:bg-black/20 rounded-lg" : ""}`;
        lapRow.innerHTML = `
          <span class="text-xs app-text-sec font-medium">${t("lap_text")} ${lap.index}</span>
          <div class="flex items-center gap-4">
            <span class="font-mono text-[10px] app-text-sec opacity-60 w-16 text-right">${this.formatTime(lap.total, true)}</span>
            <span class="font-mono text-xs font-bold ${isLatest ? "primary-text" : "app-text"} w-16 text-right">${this.formatTime(lap.diff, true)}</span>
          </div>
        `;
        lapsFragment.appendChild(lapRow);
      });
      lapsContainer.appendChild(lapsFragment);
      fragment.appendChild(sessionDiv);
    });
    listEl.appendChild(fragment);
  },
};
