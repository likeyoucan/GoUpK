// ===== timer.js (ФИНАЛЬНАЯ ВЕРСИЯ) =====

import { $, showToast, pad, updateText, updateTitle, requestWakeLock, releaseWakeLock, bgWorker, announceToScreenReader } from "./utils.js";
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
    this.els = { inputs: $("tm-inputs"), resetBtn: $("tm-resetBtn"), circleBtn: $("tm-circleBtn"), status: $("tm-statusText"), display: $("tm-mainDisplay"), ring: $("tm-progressRing"), h: $("tm-h"), m: $("tm-m"), s: $("tm-s") };
    if (this.els.ring) { this.els.ring.style.strokeDasharray = this.ringLength; this.els.ring.style.strokeDashoffset = this.ringLength; }
    document.addEventListener("timerStarted", (e) => { if (e.detail !== "timer" && this.isRunning) this.toggle(); });
    this.els.circleBtn?.addEventListener("click", () => this.toggle());
    this.els.resetBtn?.addEventListener("click", () => this.reset(true));
    $("tm-form")?.addEventListener("submit", (e) => { e.preventDefault(); document.activeElement?.blur(); });
    [this.els.h, this.els.m, this.els.s].forEach(i => {
      if (!i) return;
      const max = i === this.els.h ? 99 : 59;
      i.addEventListener("focus", () => { if (i.value === "00" || i.value === "0") i.value = ""; });
      i.addEventListener("input", () => { i.value = i.value.replace(/\D/g, "").slice(0, 2); if (parseInt(i.value, 10) > max) i.value = max; });
      i.addEventListener("blur", () => { i.value = pad(i.value || 0); });
    });
    this.setupScrollInteraction(this.els.h, 99, false);
    this.setupScrollInteraction(this.els.m, 59, true);
    this.setupScrollInteraction(this.els.s, 59, true);
    bgWorker.addEventListener("message", (e) => { if (e.data === "tick" && this.isRunning && document.hidden) this.tick(true); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.isRunning) {
        this.updateDisplay(Math.max(0, this.targetTime - performance.now()));
        this.lastRender = 0;
        this.tick();
      }
    });
  },

  setupScrollInteraction(input, max, isWrap) {
    if (!input) return;
    let startY = 0, isDragging = false;
    const threshold = 15;
    const updateVal = (delta) => {
      let val = parseInt(input.value || 0, 10);
      val = isWrap ? (val + delta + (max + 1)) % (max + 1) : Math.max(0, Math.min(max, val + delta));
      input.value = pad(val);
      sm.play("click"); sm.vibrate(10);
    };
    input.addEventListener("wheel", (e) => { e.preventDefault(); updateVal(e.deltaY > 0 ? -1 : 1); }, { passive: false });
    input.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
    input.addEventListener("touchmove", (e) => { const diff = startY - e.touches[0].clientY; if (Math.abs(diff) > threshold) { e.preventDefault(); input.blur(); updateVal(diff > 0 ? 1 : -1); startY = e.touches[0].clientY; } }, { passive: false });
    const onMouseMove = (e) => { if (!isDragging) return; const diff = startY - e.clientY; if (Math.abs(diff) > threshold) { updateVal(diff > 0 ? 1 : -1); startY = e.clientY; } };
    const onMouseUp = () => { isDragging = false; window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
    input.addEventListener("mousedown", (e) => { isDragging = true; startY = e.clientY; window.addEventListener("mousemove", onMouseMove); window.addEventListener("mouseup", onMouseUp); });
  },

  toggle() {
    sm.vibrate(50); sm.play("click"); sm.unlock();
    if (this.isRunning) {
      this.isRunning = false; this.isPaused = true;
      this.remainingAtPause = Math.max(0, this.targetTime - performance.now());
      bgWorker.postMessage("stop"); cancelAnimationFrame(this.rAF); releaseWakeLock(); updateTitle("");
    } else {
      document.dispatchEvent(new CustomEvent("timerStarted", { detail: "timer" }));
      if (!this.isPaused) {
        const h = parseInt(this.els.h.value, 10) || 0, m = parseInt(this.els.m.value, 10) || 0, s = parseInt(this.els.s.value, 10) || 0;
        this.totalDuration = (h * 3600 + m * 60 + s) * 1000;
        if (this.totalDuration === 0) { showToast(t("timer_zero")); this.els.inputs.classList.add("animate-shake"); setTimeout(() => this.els.inputs.classList.remove("animate-shake"), 300); return; }
        this.targetTime = performance.now() + this.totalDuration;
      } else { this.targetTime = performance.now() + this.remainingAtPause; }
      this.isRunning = true; this.isPaused = false;
      requestWakeLock(); bgWorker.postMessage("start"); this.tick();
    }
    this.updateUIState();
  },

  reset(clearInputs = true) {
    sm.vibrate(30); sm.play("click");
    this.isRunning = false; this.isPaused = false;
    bgWorker.postMessage("stop"); cancelAnimationFrame(this.rAF); releaseWakeLock(); updateTitle("");
    if (clearInputs) { if (this.els.h) this.els.h.value = "00"; if (this.els.m) this.els.m.value = "00"; if (this.els.s) this.els.s.value = "00"; }
    this.updateUIState();
    this.els.ring.style.strokeDashoffset = this.ringLength;
    updateText(this.els.display, "GO");
    this.els.display.classList.add("is-go");
  },

  updateUIState() {
    const isEditing = !this.isRunning && !this.isPaused;
    this.els.inputs.classList.toggle("hidden", !isEditing); this.els.inputs.classList.toggle("opacity-0", !isEditing);
    this.els.resetBtn.classList.toggle("hidden", !this.isPaused);
    this.els.status.classList.toggle("hidden", !this.isPaused);
    this.els.display.classList.toggle("is-go", isEditing);
    if (this.isPaused) updateText(this.els.status, t("pause"));
    if (isEditing) updateText(this.els.display, "GO");
  },

  tick(isBackground = false) {
    if (!this.isRunning) return;
    const now = performance.now();
    const remaining = Math.max(0, this.targetTime - now);
    if (now - this.lastRender >= 16 || isBackground) {
      const sTotal = Math.ceil(remaining / 1000);
      if (!isBackground) this.updateDisplay(remaining);
      else updateTitle(this.getFormattedTime(sTotal));
      this.lastRender = now;
    }
    if (remaining <= 0) {
      this.isRunning = false; bgWorker.postMessage("stop"); sm.vibrate([200, 100, 200, 100, 400]); sm.play("complete");
      announceToScreenReader(t("timer_finished"));
      requestAnimationFrame(() => { showToast(t("timer_finished")); this.reset(false); });
      return;
    }
    if (!isBackground) { cancelAnimationFrame(this.rAF); this.rAF = requestAnimationFrame(() => this.tick()); }
  },

  getFormattedTime(sTotal) {
    const h = Math.floor(sTotal / 3600), m = Math.floor((sTotal % 3600) / 60), s = sTotal % 60;
    if (this.totalDuration >= 3600000 || h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (this.totalDuration >= 60000 || m > 0) return `${pad(m)}:${pad(s)}`;
    return `${s}`;
  },

  updateDisplay(rem) {
    const sTotal = Math.ceil(rem / 1000);
    const timeStr = this.getFormattedTime(sTotal);
    updateText(this.els.display, timeStr);
    updateTitle(timeStr);
    this.els.ring.style.strokeDashoffset = this.ringLength - (Math.max(0, this.totalDuration - rem) / this.totalDuration) * this.ringLength;
  },
};