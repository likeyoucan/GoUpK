// tabata.js

import {
  $,
  escapeHTML,
  showToast,
  formatTimeStr,
  adjustVal,
  updateText,
  updateTitle,
  requestWakeLock,
  releaseWakeLock,
  bgWorker,
  safeSetLS,
  safeGetLS,
  announceToScreenReader,
} from "./utils.js";
import { sm } from "./sound.js";
import { t } from "./i18n.js";
import { createModal } from "./modal.js";

const tbModal = createModal("template-tb-modal");

export const tb = {
  closeTimeoutId: null,
  workouts: [],
  selectedId: null,
  work: 20,
  rest: 10,
  rounds: 8,
  currentRound: 1,
  status: "STOPPED",
  phaseDuration: 0,
  phaseEndTime: 0,
  remainingAtPause: 0,
  rAF: null,
  lastRender: 0,
  paused: false,
  els: {},
  lastBeepSec: 0,
  editingWorkoutId: null,
  ringLength: 282.74,

  init() {
    this.els = {
      listSection: $("tb-list-section"),
      runningControls: $("tb-runningControls"),
      list: $("tb-workoutsList"),
      startBtn: $("tb-startBtn"),
      stopBtn: $("tb-stopBtn"),
      ring: $("tb-progressRing"),
      status: $("tb-statusText"),
      timer: $("tb-mainTimer"),
      activeName: $("tb-activeName"),
      activeDetail: $("tb-activeDetail"),
      roundDisplay: $("tb-currentRound"),
      totalRoundsDisplay: $("tb-totalRounds"),
    };
    if (this.els.ring) {
      this.els.ring.style.strokeDasharray = this.ringLength;
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }

    this.setupEventListeners();

    try {
      const stored = safeGetLS("tb_workouts");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.workouts = parsed;
        } else {
          throw new Error("Invalid or empty array in localStorage");
        }
      } else {
        throw new Error("No data in localStorage");
      }
    } catch (e) {
      this.workouts = [
        { id: 1, name: "Standard Tabata", work: 20, rest: 10, rounds: 8 },
      ];
      safeSetLS("tb_workouts", JSON.stringify(this.workouts));
    }

    let lastSelectedId = safeGetLS("tb_selected_id");
    if (lastSelectedId) lastSelectedId = Number(lastSelectedId);
    const exists = this.workouts.find((w) => w.id === lastSelectedId);
    if (exists) {
      this.selectWorkout(lastSelectedId);
    } else if (this.workouts.length > 0) {
      this.selectWorkout(this.workouts[0].id);
    }
    this.renderList();
  },

  setupEventListeners() {
    document.addEventListener("timerStarted", (e) => {
      if (e.detail !== "tabata" && this.status !== "STOPPED" && !this.paused)
        this.pause();
    });

    document.addEventListener("languageChanged", () => this.updateUIText());

    bgWorker.addEventListener("message", (e) => {
      if (
        e.data.type === "heartbeat:tick" &&
        this.status !== "STOPPED" &&
        !this.paused &&
        document.hidden
      ) {
        this.tick(true);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        this.status !== "STOPPED" &&
        !this.paused
      ) {
        this.lastRender = 0;
        this.tick();
      }
    });

    this.els.startBtn?.addEventListener("click", () => this.toggle());
    this.els.stopBtn?.addEventListener("click", () => this.stop());

    $("tb-openModalBtn")?.addEventListener("click", () => this.openModal(null));

    // Делегированные слушатели
    document.body.addEventListener("click", (e) => {
      if (e.target.id === "tb-closeModalBtn") this.closeModal();

      const tbAdjBtn = e.target.closest("[data-tb-adj]");
      if (tbAdjBtn) {
        const [id, delta] = tbAdjBtn.getAttribute("data-tb-adj").split(",");
        adjustVal(id, parseInt(delta));
      }

      if (this.els.list) {
        const delBtn = e.target.closest(".tb-del-btn");
        const editBtn = e.target.closest(".tb-edit-btn");
        const row = e.target.closest(".tb-workout-row");
        if (delBtn) {
          e.stopPropagation();
          this.deleteWorkout(Number(delBtn.dataset.id));
        } else if (editBtn) {
          e.stopPropagation();
          this.openModal(Number(editBtn.dataset.id));
        } else if (row) {
          this.selectWorkout(Number(row.dataset.id));
        }
      }
    });

    document.body.addEventListener("input", (e) => {
      if (e.target.id === "tb-edit-name")
        $("tb-name-error")?.classList.add("hidden");
    });

    this.els.list?.addEventListener("keydown", (e) => {
      const row = e.target.closest(".tb-workout-row");
      if (e.key === "Enter" && row) this.selectWorkout(Number(row.dataset.id));
    });
  },

  getUniqueName(baseName) {
    let name = baseName;
    let counter = 1;
    const exists = (n) =>
      this.workouts.some((w) => w.name.toLowerCase() === n.toLowerCase());
    while (exists(name)) {
      name = `${baseName} ${counter}`;
      counter++;
    }
    return name;
  },

  openModal(idToEdit = null) {
    tbModal.open();
    setTimeout(() => {
      $("tb-name-error")?.classList.add("hidden");
      this.editingWorkoutId = idToEdit;
      const nameInput = $("tb-edit-name");
      const workInput = $("tb-edit-work");
      const restInput = $("tb-edit-rest");
      const roundsInput = $("tb-edit-rounds");

      if (idToEdit) {
        const w = this.workouts.find((x) => x.id === idToEdit);
        if (w) {
          nameInput.value = w.name;
          workInput.value = w.work;
          restInput.value = w.rest;
          roundsInput.value = w.rounds;
        }
      } else {
        nameInput.value = this.getUniqueName(t("tabata"));
        workInput.value = 20;
        restInput.value = 10;
        roundsInput.value = 8;
      }
      nameInput.focus();
    }, 0);
  },

  closeModal() {
    tbModal.close();
    setTimeout(() => {
      this.editingWorkoutId = null;
    }, 300);
  },

  saveWorkout() {
    const nameInput = $("tb-edit-name");
    let finalName = nameInput.value.trim();
    if (!finalName) finalName = this.getUniqueName(t("tabata"));
    const exists = this.workouts.some(
      (w) =>
        w.name.toLowerCase() === finalName.toLowerCase() &&
        w.id !== this.editingWorkoutId,
    );
    if (exists) {
      $("tb-name-error")?.classList.remove("hidden");
      nameInput.classList.add("animate-shake");
      setTimeout(() => nameInput.classList.remove("animate-shake"), 300);
      return;
    }
    const w = Math.max(1, parseInt($("tb-edit-work").value) || 20);
    const r = Math.max(1, parseInt($("tb-edit-rest").value) || 10);
    const rnd = Math.max(1, parseInt($("tb-edit-rounds").value) || 8);
    if (this.editingWorkoutId) {
      const index = this.workouts.findIndex(
        (x) => x.id === this.editingWorkoutId,
      );
      if (index !== -1) {
        this.workouts[index] = {
          ...this.workouts[index],
          name: finalName,
          work: w,
          rest: r,
          rounds: rnd,
        };
      }
    } else {
      const newW = {
        id: Date.now(),
        name: finalName,
        work: w,
        rest: r,
        rounds: rnd,
      };
      this.workouts.push(newW);
      this.editingWorkoutId = newW.id;
    }
    safeSetLS("tb_workouts", JSON.stringify(this.workouts));
    this.renderList();
    this.selectWorkout(this.editingWorkoutId);
    this.closeModal();
  },

  deleteWorkout(id) {
    if (this.status !== "STOPPED") {
      showToast(t("active_timer"));
      return;
    }
    if (this.workouts.length <= 1) {
      showToast(t("cannot_delete"));
      return;
    }
    this.workouts = this.workouts.filter((w) => w.id !== id);
    safeSetLS("tb_workouts", JSON.stringify(this.workouts));
    if (this.selectedId === id) this.selectWorkout(this.workouts[0].id);
    this.renderList();
  },

  selectWorkout(id) {
    if (this.status !== "STOPPED") return;
    const w = this.workouts.find((k) => k.id === id);
    if (!w) return;
    this.selectedId = id;
    safeSetLS("tb_selected_id", id);
    this.work = w.work * 1000;
    this.rest = w.rest * 1000;
    this.rounds = w.rounds;
    updateText(this.els.activeName, w.name);
    this.updateUIText(); // Обновляем детали активной тренировки
    this.renderList();
  },

  renderList() {
    if (!this.els.list) return;
    this.els.list.replaceChildren();
    const fragment = document.createDocumentFragment();
    this.workouts.forEach((w) => {
      const div = document.createElement("div");
      const isAct = w.id === this.selectedId;
      div.tabIndex = 0;
      div.setAttribute("role", "button");
      div.className = `tb-workout-row p-4 rounded-xl flex justify-between items-center transition-all cursor-pointer mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] ${isAct ? "app-surface border-2 border-[var(--primary-color)] shadow-md" : "app-surface border app-border shadow-sm"}`;
      div.dataset.id = w.id;
      div.innerHTML = `
        <div class="flex-1 min-w-0 pr-2">
            <div class="font-bold truncate ${isAct ? "primary-text" : "app-text"}">${escapeHTML(w.name)}</div>
            <div class="text-xs app-text-sec mt-1">${w.work}${t("sec").toLowerCase()} / ${w.rest}${t("sec").toLowerCase()} • ${w.rounds} <span data-i18n-text="rds">${t("rds")}</span></div>
        </div>
        <div class="flex gap-1 shrink-0">
            <button type="button" aria-label="${t("edit")}" data-i18n-aria="edit" data-id="${w.id}" class="tb-edit-btn text-gray-400 hover:primary-text p-2 focus:outline-none custom-focus rounded-lg active:scale-95">
                <svg focusable="false" aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button type="button" aria-label="${t("delete")}" data-i18n-aria="delete" data-id="${w.id}" class="tb-del-btn text-red-500 opacity-50 hover:opacity-100 p-2 focus:outline-none custom-focus rounded-lg active:scale-95">
                <svg focusable="false" aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
      `;
      fragment.appendChild(div);
    });
    this.els.list.appendChild(fragment);
  },

  updateUIText() {
    if (this.selectedId) {
      const w = this.workouts.find((k) => k.id === this.selectedId);
      if (w) {
        updateText(
          this.els.activeDetail,
          `${w.work}${t("sec").toLowerCase()} / ${w.rest}${t("sec").toLowerCase()} • ${w.rounds} ${t("rds")}`,
        );
      }
    }
    this.els.list
      ?.querySelectorAll("[data-i18n-text]")
      .forEach((el) => updateText(el, t(el.getAttribute("data-i18n-text"))));
    this.els.list
      ?.querySelectorAll("[data-i18n-aria]")
      .forEach((el) =>
        el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))),
      );
  },

  toggle() {
    sm.vibrate(50);
    sm.play("click");
    sm.unlock();
    if (this.status === "STOPPED") this.start();
    else if (this.paused) this.resume();
    else this.pause();
  },

  start() {
    document.dispatchEvent(
      new CustomEvent("timerStarted", { detail: "tabata" }),
    );
    this.currentRound = 1;
    this.status = "READY";
    this.phaseDuration = 5000;
    this.phaseEndTime = performance.now() + this.phaseDuration;
    this.paused = false;
    this.lastBeepSec = 0;
    this.els.listSection.classList.add("hidden");
    this.els.runningControls.classList.remove("hidden");
    this.els.runningControls.classList.add("flex");
    updateText(this.els.totalRoundsDisplay, this.rounds);
    this.els.status.classList.remove("hidden");
    this.els.timer.classList.remove("is-go");
    requestWakeLock();
    this.updatePhaseStyles();
    bgWorker.postMessage("start");
    this.tick();
  },

  pause() {
    this.paused = true;
    bgWorker.postMessage("stop");
    cancelAnimationFrame(this.rAF);
    this.remainingAtPause = this.phaseEndTime - performance.now();
    updateText(this.els.status, t("pause"));
    releaseWakeLock();
    updateTitle("");
  },

  resume() {
    document.dispatchEvent(
      new CustomEvent("timerStarted", { detail: "tabata" }),
    );
    this.paused = false;
    this.phaseEndTime = performance.now() + this.remainingAtPause;
    this.lastBeepSec = 0;
    requestWakeLock();
    bgWorker.postMessage("start");
    this.tick();
    this.updatePhaseStyles();
  },

  stop() {
    sm.vibrate(30);
    sm.play("click");
    bgWorker.postMessage("stop");
    cancelAnimationFrame(this.rAF);
    this.status = "STOPPED";
    this.paused = false;
    releaseWakeLock();
    updateTitle("");
    this.els.listSection.classList.remove("hidden");
    this.els.runningControls.classList.remove("flex");
    this.els.runningControls.classList.add("hidden");
    this.els.status.classList.add("hidden");
    updateText(this.els.timer, "GO");
    this.els.timer.classList.add("is-go");
    if (this.els.ring) {
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }
  },

  tick(isBackground = false) {
    if (this.status === "STOPPED" || this.paused) return;
    const now = performance.now();
    const rem = this.phaseEndTime - now;
    if (rem <= 0) {
      const isDeepSleepWakeup = rem < -2000;
      this.nextPhase(isDeepSleepWakeup ? Math.abs(rem) : 0);
      return;
    }
    if (now - this.lastRender >= 16 || isBackground) {
      if (!isBackground) {
        this.render(rem);
      } else {
        const sTotal = Math.max(0, Math.ceil(rem / 1000));
        updateTitle(`${this.status}: ${formatTimeStr(sTotal, false)}`);
      }
      this.lastRender = now;
    }
    if (!isBackground) {
      cancelAnimationFrame(this.rAF);
      this.rAF = requestAnimationFrame(() => this.tick());
    }
  },

  nextPhase(missedTime = 0) {
    if (missedTime === 0) sm.vibrate([100, 50, 100]);
    this.lastBeepSec = 0;
    if (missedTime > 0) {
      let remainingMissed = missedTime;
      while (remainingMissed > 0 && this.status !== "STOPPED") {
        if (this.status === "READY") {
          let step = Math.min(remainingMissed, this.phaseDuration);
          remainingMissed -= step;
          this.phaseDuration -= step;
          if (this.phaseDuration <= 0) {
            this.status = "WORK";
            this.phaseDuration = this.work;
          }
        } else if (this.status === "WORK") {
          let step = Math.min(remainingMissed, this.phaseDuration);
          remainingMissed -= step;
          this.phaseDuration -= step;
          if (this.phaseDuration <= 0) {
            if (this.currentRound >= this.rounds) {
              this.stop();
              return;
            }
            this.status = "REST";
            this.phaseDuration = this.rest;
          }
        } else if (this.status === "REST") {
          let step = Math.min(remainingMissed, this.phaseDuration);
          remainingMissed -= step;
          this.phaseDuration -= step;
          if (this.phaseDuration <= 0) {
            this.currentRound++;
            this.status = "WORK";
            this.phaseDuration = this.work;
          }
        }
      }
      this.phaseEndTime = performance.now() + this.phaseDuration;
    } else {
      if (this.status === "READY") {
        this.status = "WORK";
        this.phaseDuration = this.work;
        sm.play("work_start");
      } else if (this.status === "WORK") {
        if (this.currentRound >= this.rounds) {
          sm.vibrate([200, 100, 200, 100, 400]);
          sm.play("complete");
          announceToScreenReader(t("tabata_complete"));
          requestAnimationFrame(() => {
            showToast(t("tabata_complete"));
            this.stop();
          });
          return;
        }
        this.status = "REST";
        this.phaseDuration = this.rest;
        sm.play("rest_start");
      } else if (this.status === "REST") {
        this.currentRound++;
        this.status = "WORK";
        this.phaseDuration = this.work;
        sm.play("work_start");
      }
      this.phaseEndTime = performance.now() + this.phaseDuration;
    }
    this.updatePhaseStyles();
    this.tick();
  },

  updatePhaseStyles() {
    if (!this.els.ring) return;
    updateText(this.els.roundDisplay, this.currentRound);
    const statusEl = this.els.status;
    statusEl.classList.remove("primary-text", "text-blue-500", "app-text-sec");
    this.els.ring.classList.remove("primary-stroke");
    this.els.ring.style.stroke = "";
    if (this.status === "WORK") {
      updateText(statusEl, t("work"));
      statusEl.classList.add("primary-text");
      this.els.ring.classList.add("primary-stroke");
    } else if (this.status === "REST") {
      updateText(statusEl, t("rest"));
      statusEl.classList.add("text-blue-500");
      this.els.ring.style.stroke = "#3b82f6";
    } else {
      updateText(statusEl, t("get_ready"));
      statusEl.classList.add("app-text-sec");
      this.els.ring.classList.add("primary-stroke");
    }
  },

  render(rem) {
    const sTotal = Math.max(0, Math.ceil(rem / 1000));
    if (sTotal <= 3 && sTotal > 0 && this.lastBeepSec !== sTotal) {
      sm.play("tick");
      this.lastBeepSec = sTotal;
    }
    const timeStr = formatTimeStr(sTotal, false);
    updateText(this.els.timer, timeStr);
    updateTitle(`${this.status}: ${timeStr}`);
    if (this.els.ring) {
      this.els.ring.style.strokeDashoffset =
        this.ringLength -
        (Math.max(0, this.phaseDuration - rem) / this.phaseDuration) *
          this.ringLength;
    }
  },
};
