// ===== stopwatch.js (ФИНАЛЬНАЯ ВЕРСИЯ) =====

import { $, escapeHTML, showToast, formatMilliseconds, getExtendedDisplay, updateText, updateTitle, requestWakeLock, releaseWakeLock, bgWorker, safeSetLS, safeGetLS, safeRemoveLS, announceToScreenReader } from "./utils.js";
import { sm } from "./sound.js";
import { t } from "./i18n.js";
import { themeManager } from "./theme.js";

export const sw = {
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
    this.els = {
      display: $("sw-mainDisplay"), extendedDisplay: $("sw-extendedDisplay"), status: $("sw-statusText"),
      btn: $("sw-startStopBtn"), lapBtn: $("sw-lapBtn"), lapsContainer: $("sw-lapsContainer"),
      ring: $("sw-progressRing"), saveBtn: $("sw-saveBtn"), openResultsBtn: $("sw-openResultsBtn"),
      closeResultsBtn: $("sw-closeResultsBtn"), modal: $("sw-sessions-modal"), sessionsList: $("sw-sessionsList"),
      sortSelect: $("sw-sortSelect"), nameModal: $("sw-name-modal"), nameModalContent: $("sw-name-modal-content"),
      nameTitle: $("sw-name-title"), nameInput: $("sw-name-input"), nameError: $("sw-name-error"),
      nameCancel: $("sw-name-cancel"), nameConfirm: $("sw-name-confirm"), lapFlash: $("sw-lapFlash"),
      currentLapsHeader: $("sw-currentLapsHeader"), clearAllBtn: $("sw-clearAllBtn"), clearModal: $("sw-clear-modal"),
      clearModalContent: $("sw-clear-modal-content"), clearCancel: $("sw-clear-cancel"), clearConfirm: $("sw-clear-confirm"),
    };
    if (this.els.ring) { this.els.ring.style.strokeDasharray = this.ringLength; this.els.ring.style.strokeDashoffset = this.ringLength; }
    document.addEventListener("timerStarted", (e) => { if (e.detail !== "stopwatch" && this.isRunning) this.toggle(); });
    bgWorker.addEventListener("message", (e) => { if (e.data === "tick" && this.isRunning && document.hidden) this.tick(true); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && this.isRunning) { this.lastRender = 0; this.tick(); } });
    this.els.btn?.addEventListener("click", () => this.toggle());
    this.els.lapBtn?.addEventListener("click", () => this.recordLapOrReset());
    this.els.saveBtn?.addEventListener("click", () => this.prepareSaveSession());
    this.els.openResultsBtn?.addEventListener("click", () => this.openModal());
    this.els.closeResultsBtn?.addEventListener("click", () => this.closeModal());
    this.els.sortSelect?.addEventListener("change", (e) => this.sortSessions(e.target.value));
    this.els.nameCancel?.addEventListener("click", () => this.closeNameModal());
    this.els.nameInput?.addEventListener("input", () => this.els.nameError?.classList.add("hidden"));
    this.els.clearAllBtn?.addEventListener("click", () => { if (this.savedSessions.length > 0) this.openClearModal(); });
    this.els.clearCancel?.addEventListener("click", () => this.closeClearModal());
    this.els.clearConfirm?.addEventListener("click", () => this.confirmClearAll());
    this.els.sessionsList?.addEventListener("click", (e) => {
      const header = e.target.closest(".sw-session-header"), renameBtn = e.target.closest(".sw-rename-btn"), deleteBtn = e.target.closest(".sw-delete-btn");
      if (renameBtn) this.prepareRenameSession(renameBtn.dataset.id, e);
      else if (deleteBtn) this.deleteSession(deleteBtn.dataset.id, e);
      else if (header) this.toggleSessionDetails(header.dataset.id);
    });
    try { const stored = safeGetLS("sw_saved_sessions"); this.savedSessions = stored ? (JSON.parse(stored) || []) : []; }
    catch (e) { console.warn("Failed to parse stopwatch sessions", e); this.savedSessions = []; }
    document.addEventListener("languageChanged", () => { this.renderSavedSessions(); if (this.laps.length > 0) this.reRenderCurrentLaps(); });
    document.addEventListener("msChanged", () => { if (!this.isRunning && this.elapsedTime > 0) this.updateDisplay(); if (this.laps.length > 0) this.reRenderCurrentLaps(); });
  },

  formatTime(ms, forceMs = null) { const showMs = forceMs !== null ? forceMs : themeManager.showMs; return formatMilliseconds(ms, { showMs, showHours: 'auto' }); },
  getUniqueName(baseName) { let name = baseName, counter = 1; while (this.savedSessions.some(s => s.name.toLowerCase() === name.toLowerCase())) { name = `${baseName} ${counter++}`; } return name; },

  toggle() {
    sm.vibrate(50); sm.play("click"); sm.unlock();
    this.isRunning = !this.isRunning;
    if (!this.isRunning) {
      this.pauseTime = performance.now();
      bgWorker.postMessage("stop"); cancelAnimationFrame(this.rAF); releaseWakeLock(); updateTitle("");
      this.els.status.classList.remove("hidden");
      updateText(this.els.lapBtn, t("reset"));
      this.els.lapBtn.classList.replace("app-surface", "bg-red-500"); this.els.lapBtn.classList.replace("app-text", "text-white"); this.els.lapBtn.classList.add("is-reset");
      announceToScreenReader(`${t("stopwatch")} ${t("pause")}. ${this.formatTime(this.elapsedTime, false)}`);
    } else {
      document.dispatchEvent(new CustomEvent("timerStarted", { detail: "stopwatch" }));
      this.startTime = performance.now() - this.elapsedTime; this.pauseTime = 0;
      requestWakeLock(); bgWorker.postMessage("start"); this.tick();
      this.els.status.classList.add("hidden"); this.els.display.classList.remove("is-go"); this.els.lapBtn.classList.remove("hidden");
      updateText(this.els.lapBtn, t("lap"));
      this.els.lapBtn.classList.replace("bg-red-500", "app-surface"); this.els.lapBtn.classList.replace("text-white", "app-text"); this.els.lapBtn.classList.remove("is-reset");
    }
    this.updateSaveButtonVisibility();
  },

  tick(isBackground = false) {
    if (!this.isRunning) return;
    const now = performance.now(); this.elapsedTime = now - this.startTime;
    if (now - this.lastRender >= 16 || isBackground) {
      if (!isBackground) this.updateDisplay();
      else updateTitle(formatMilliseconds(this.elapsedTime, { showMs: false, showHours: 'auto' }));
      this.lastRender = now;
    }
    if (!isBackground) { cancelAnimationFrame(this.rAF); this.rAF = requestAnimationFrame(() => this.tick()); }
  },

  updateDisplay() {
    const timeStr = formatMilliseconds(this.elapsedTime, { showMs: themeManager.showMs, showHours: false });
    updateText(this.els.display, timeStr);
    const extStr = getExtendedDisplay(this.elapsedTime, t("day_short"), t("hour_short"));
    if (this.els.extendedDisplay) {
      updateText(this.els.extendedDisplay, extStr);
      this.els.extendedDisplay.classList.toggle("hidden", !extStr);
    }
    updateTitle(this.formatTime(this.elapsedTime, false));
    this.els.ring.style.strokeDashoffset = this.ringLength - ((this.elapsedTime % 60000) / 60000) * this.ringLength;
  },

  createLapElement(lap, isLatest = false) {
    const div = document.createElement("div");
    div.className = `lap-row flex justify-between items-center py-3 border-b app-border px-3 rounded-lg transition-all duration-300 ${isLatest ? "bg-black/5 dark:bg-white/5" : ""}`;
    div.innerHTML = `<span class="text-xs app-text-sec font-medium">${t("lap_text")} ${lap.index}</span><div class="flex items-center gap-4"><span class="font-mono text-[10px] app-text-sec opacity-60 w-16 text-right">${this.formatTime(lap.total, true)}</span><span class="split-time font-mono text-xs font-bold ${isLatest ? "primary-text" : "app-text"} w-16 text-right">${this.formatTime(lap.diff, true)}</span></div>`;
    return div;
  },

  recordLapOrReset() {
    sm.vibrate(30); sm.play("click");
    if (this.isRunning) {
      const diff = this.elapsedTime - (this.laps[0]?.total || 0);
      const newLap = { total: this.elapsedTime, diff, index: this.laps.length + 1 };
      this.laps.unshift(newLap);
      if (this.laps.length === 1) { this.els.lapsContainer.innerHTML = ""; this.els.currentLapsHeader.classList.remove("hidden"); }
      else { const prev = this.els.lapsContainer.firstElementChild; if (prev) { prev.classList.remove("bg-black/5", "dark:bg-white/5"); prev.querySelector(".split-time")?.classList.replace("primary-text", "app-text"); } }
      this.els.lapsContainer.prepend(this.createLapElement(newLap, true));
      if (this.els.lapFlash) { this.els.lapFlash.classList.remove("flash-active"); void this.els.lapFlash.offsetWidth; this.els.lapFlash.classList.add("flash-active"); }
    } else if (this.elapsedTime > 0) {
      this.elapsedTime = 0; this.laps = []; this.pauseTime = 0;
      updateText(this.els.display, "GO"); this.els.display.classList.add("is-go");
      this.els.status.classList.add("hidden"); this.els.extendedDisplay?.classList.add("hidden");
      this.els.ring.style.strokeDashoffset = this.ringLength;
      this.els.lapBtn.classList.add("hidden"); this.els.currentLapsHeader.classList.add("hidden");
      this.els.lapsContainer.innerHTML = `<div class="text-center app-text-sec opacity-50 mt-4 text-sm" data-i18n="no_laps">${t("no_laps")}</div>`;
    }
    this.updateSaveButtonVisibility();
  },

  reRenderCurrentLaps() { this.els.lapsContainer.innerHTML = ""; [...this.laps].reverse().forEach((lap, i, arr) => this.els.lapsContainer.prepend(this.createLapElement(lap, i === arr.length - 1))); },
  updateSaveButtonVisibility() { this.els.saveBtn.classList.toggle("hidden", this.laps.length === 0 && this.elapsedTime === 0); },

  prepareSaveSession() {
    if (this.laps.length === 0 && this.elapsedTime === 0) return;
    let sessionLaps = [...this.laps]; let total = this.laps[0]?.total || 0;
    if (this.elapsedTime > total && this.elapsedTime - total > 10) sessionLaps.unshift({ total: this.elapsedTime, diff: this.elapsedTime - total, index: sessionLaps.length + 1 });
    const defaultName = this.getUniqueName(t("stopwatch"));
    this.nameModalState.pendingSession = { id: crypto.randomUUID?.() || `fallback-${Date.now()}-${Math.random().toString(36).substring(2)}`, name: "", date: this.pauseTime || Date.now(), totalTime: this.elapsedTime, laps: sessionLaps };
    this.openNameModal("save", defaultName);
  },

  prepareRenameSession(id, e) { e?.stopPropagation(); const session = this.savedSessions.find(s => String(s.id) === String(id)); if (session) this.openNameModal("rename", session.name, id); },
  openNameModal(action, defaultName, targetId = null) { this.nameModalState = { action, targetId, pendingSession: this.nameModalState.pendingSession }; this.els.nameError?.classList.add("hidden"); if (this.els.nameTitle) updateText(this.els.nameTitle, action === "rename" ? t("rename") : t("save_session")); this.els.nameInput.value = defaultName; this.els.nameModal.classList.remove("hidden"); this.els.nameModal.classList.add("flex"); this.els.nameModal.removeAttribute("inert"); this.els.nameModal.removeAttribute("aria-hidden"); void this.els.nameModal.offsetWidth; this.els.nameModal.classList.remove("opacity-0"); this.els.nameModalContent.classList.remove("opacity-0", "scale-95"); setTimeout(() => this.els.nameInput.focus(), 100); },
  closeNameModal() { this.els.nameModal.classList.add("opacity-0"); this.els.nameModalContent.classList.add("opacity-0", "scale-95"); setTimeout(() => { this.els.nameModal.classList.add("hidden"); this.els.nameModal.classList.remove("flex"); this.els.nameModal.setAttribute("inert", ""); this.els.nameModal.setAttribute("aria-hidden", "true"); this.nameModalState = { action: null, targetId: null, pendingSession: null }; }, 300); },
  
  confirmNameModal() {
    const finalName = this.els.nameInput.value.trim() || this.els.nameInput.placeholder;
    const isDuplicate = this.savedSessions.some(s => s.name.toLowerCase() === finalName.toLowerCase() && (this.nameModalState.action === "save" || String(s.id) !== String(this.nameModalState.targetId)));
    if (isDuplicate) { this.els.nameError?.classList.remove("hidden"); this.els.nameInput.classList.add("animate-shake"); setTimeout(() => this.els.nameInput.classList.remove("animate-shake"), 300); return; }
    if (this.nameModalState.action === "save") { const session = this.nameModalState.pendingSession; session.name = finalName; this.savedSessions.push(session); showToast(t("session_saved")); }
    else if (this.nameModalState.action === "rename") { const session = this.savedSessions.find(s => String(s.id) === String(this.nameModalState.targetId)); if (session) session.name = finalName; this.renderSavedSessions(); }
    safeSetLS("sw_saved_sessions", JSON.stringify(this.savedSessions)); this.closeNameModal();
  },

  openClearModal() { this.els.clearModal.classList.remove("hidden", "opacity-0"); this.els.clearModal.classList.add("flex"); this.els.clearModal.removeAttribute("inert"); this.els.clearModal.removeAttribute("aria-hidden"); this.els.clearModalContent.classList.remove("opacity-0", "scale-95"); },
  closeClearModal() { this.els.clearModal.classList.add("opacity-0"); this.els.clearModalContent.classList.add("opacity-0", "scale-95"); setTimeout(() => { this.els.clearModal.classList.add("hidden"); this.els.clearModal.classList.remove("flex"); this.els.clearModal.setAttribute("inert", ""); this.els.clearModal.setAttribute("aria-hidden", "true"); }, 300); },
  confirmClearAll() { this.savedSessions = []; safeRemoveLS("sw_saved_sessions"); this.renderSavedSessions(); this.closeClearModal(); showToast(t("history_cleared")); },
  openModal() { this.sortSessions(this.currentSort); this.els.modal.classList.remove("hidden", "translate-y-full"); this.els.modal.classList.add("flex"); this.els.modal.removeAttribute("inert"); this.els.modal.removeAttribute("aria-hidden"); },
  closeModal() { this.els.modal.classList.add("translate-y-full"); setTimeout(() => { this.els.modal.classList.add("hidden"); this.els.modal.classList.remove("flex"); this.els.modal.setAttribute("inert", ""); this.els.modal.setAttribute("aria-hidden", "true"); }, 400); },

  sortSessions(type) {
    this.currentSort = type; this.els.sortSelect.value = type;
    this.savedSessions.sort((a, b) => {
      if (type === "date_desc") return (b.date || 0) - (a.date || 0);
      if (type === "date_asc") return (a.date || 0) - (b.date || 0);
      if (type === "name_az") return a.name.localeCompare(b.name);
      if (type === "result_fast") return a.totalTime - b.totalTime;
      return 0;
    });
    this.renderSavedSessions();
  },

  deleteSession(id, e) { e?.stopPropagation(); this.savedSessions = this.savedSessions.filter(s => String(s.id) !== String(id)); safeSetLS("sw_saved_sessions", JSON.stringify(this.savedSessions)); this.renderSavedSessions(); },
  toggleSessionDetails(id) { const detailsEl = $(`sw-details-${id}`), iconEl = $(`sw-icon-${id}`); if (!detailsEl || !iconEl) return; detailsEl.classList.toggle("hidden"); iconEl.style.transform = detailsEl.classList.contains("hidden") ? "rotate(0deg)" : "rotate(180deg)"; },

  renderSavedSessions() {
    if (!this.els.sessionsList) return; this.els.sessionsList.innerHTML = ""; this.els.clearAllBtn.disabled = this.savedSessions.length === 0;
    if (this.savedSessions.length === 0) { this.els.sessionsList.innerHTML = `<div class="text-center app-text-sec opacity-50 mt-10 text-sm">${t("empty_sessions")}</div>`; return; }
    const fragment = document.createDocumentFragment();
    this.savedSessions.forEach(session => {
      const dateObj = new Date(session.date || (typeof session.id === 'number' ? session.id : Date.now()));
      const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      let lapsHtml = `<div class="flex justify-between items-center py-1.5 border-b border-gray-500/30 mb-1 px-2"><span class="text-[10px] font-bold app-text-sec uppercase tracking-wider">${t("lap_text")}</span><div class="flex items-center gap-4"><span class="text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right">${t("total_time")}</span><span class="text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right">${t("split_time")}</span></div></div>`;
      session.laps.forEach((lap, idx) => lapsHtml += `<div class="flex justify-between items-center py-2 border-b border-gray-500/10 last:border-0 px-2 ${idx === 0 ? "bg-black/5 dark:bg-white/5 rounded-lg" : ""}"><span class="text-xs app-text-sec font-medium">${t("lap_text")} ${lap.index}</span><div class="flex items-center gap-4"><span class="font-mono text-[10px] app-text-sec opacity-60 w-16 text-right">${this.formatTime(lap.total, true)}</span><span class="font-mono text-xs font-bold ${idx === 0 ? "primary-text" : "app-text"} w-16 text-right">${this.formatTime(lap.diff, true)}</span></div></div>`);
      const div = document.createElement("div"); div.className = "app-surface border app-border rounded-xl overflow-hidden transition-all mb-3";
      div.innerHTML = `<div class="p-4 cursor-pointer flex justify-between items-center active:bg-gray-500/10 sw-session-header" data-id="${session.id}"><div class="flex-1 min-w-0 pr-4"><div class="font-bold app-text text-lg truncate">${escapeHTML(session.name)}</div><div class="text-xs app-text-sec mt-1">${dateStr}</div></div><div class="flex items-center gap-3 shrink-0"><div class="font-mono font-bold primary-text text-lg">${this.formatTime(session.totalTime, true)}</div><svg focusable="false" aria-hidden="true" id="sw-icon-${session.id}" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div></div><div id="sw-details-${session.id}" class="hidden bg-black/5 dark:bg-black/20 border-t app-border p-4"><div class="flex justify-end gap-2 mb-3"><button type="button" data-id="${session.id}" class="sw-rename-btn px-3 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-transform">${t("rename")}</button><button type="button" data-id="${session.id}" class="sw-delete-btn px-3 py-1 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-transform">${t("delete")}</button></div><div class="max-h-48 overflow-y-auto no-scrollbar bg-black/5 dark:bg-white/5 rounded-lg p-2 border app-border">${lapsHtml}</div></div>`;
      fragment.appendChild(div);
    });
    this.els.sessionsList.appendChild(fragment);
  },
};