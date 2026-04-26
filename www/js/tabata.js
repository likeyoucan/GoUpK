// Файл: www/js/tabata.js

import {
  $,
  showToast,
  formatTime,
  adjustVal,
  updateText,
  updateTitle,
  requestWakeLock,
  releaseWakeLock,
  bgWorker,
  safeSetLS,
  safeGetLS,
  announceToScreenReader,
  getUniqueName,
} from "./utils.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { store } from "./store.js?v=VERSION";

function startTimerContext() {
  requestWakeLock();
}

function stopTimerContext() {
  releaseWakeLock();
  updateTitle("");
}

export const tb = {
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
      editName: $("tb-edit-name"),
      editWork: $("tb-edit-work"),
      editRest: $("tb-edit-rest"),
      editRounds: $("tb-edit-rounds"),
      nameError: $("tb-name-error"),
      runningWorkoutName: $("tb-runningWorkoutName"),
    };

    if (this.els.ring) {
      this.els.ring.style.strokeDasharray = this.ringLength;
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }

    this.els.startBtn?.addEventListener("click", () => this.toggle());
    this.els.stopBtn?.addEventListener("click", () => this.stop());
    this.els.editName?.addEventListener("input", () =>
      this.els.nameError?.classList.add("hidden"),
    );
    document.querySelectorAll("[data-tb-adj]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        sm.vibrate(20, "light");
        const [id, delta] = e.currentTarget
          .getAttribute("data-tb-adj")
          .split(",");
        adjustVal(id, parseInt(delta));
      }),
    );
    this.els.list?.addEventListener("click", (e) => {
      const delBtn = e.target.closest(".tb-del-btn"),
        editBtn = e.target.closest(".tb-edit-btn"),
        row = e.target.closest(".tb-workout-row");
      if (delBtn) {
        e.stopPropagation();
        this.deleteWorkout(Number(delBtn.dataset.id));
      } else if (editBtn) {
        e.stopPropagation();
        modalManager.open("tb-modal", { idToEdit: Number(editBtn.dataset.id) });
      } else if (row) {
        this.selectWorkout(Number(row.dataset.id));
      }
    });

    document.addEventListener("timerStarted", (e) => {
      if (e.detail !== "tabata" && this.status !== "STOPPED" && !this.paused)
        this.pause();
    });
    document.addEventListener("languageChanged", () => {
      this.renderList();
      if (this.selectedId) this.selectWorkout(this.selectedId);
    });
    try {
      const stored = safeGetLS("tb_workouts");
      if (stored && JSON.parse(stored).length > 0)
        this.workouts = JSON.parse(stored);
      else throw new Error();
    } catch (e) {
      this.workouts = [
        { id: 1, name: "Standard Tabata", work: 20, rest: 10, rounds: 8 },
      ];
      safeSetLS("tb_workouts", JSON.stringify(this.workouts));
    }
    const lastSelectedId = safeGetLS("tb_selected_id"),
      exists = this.workouts.find((w) => w.id === Number(lastSelectedId));
    this.selectWorkout(exists ? Number(lastSelectedId) : this.workouts[0]?.id);
    this.renderList();

    bgWorker.addEventListener("message", (e) => {
      if (
        e.data?.type === "heartbeat" &&
        this.status !== "STOPPED" &&
        !this.paused &&
        document.hidden
      )
        this.tick(true);
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
  },

  prepareEdit(idToEdit = null) {
    this.els.nameError?.classList.add("hidden");
    this.editingWorkoutId = idToEdit;
    const titleEl = $("tb-modal-title");
    if (titleEl)
      updateText(titleEl, idToEdit ? t("edit") : t("create_workout"));
    if (idToEdit) {
      const w = this.workouts.find((x) => x.id === idToEdit);
      if (w) {
        this.els.editName.value = w.name;
        this.els.editWork.value = w.work;
        this.els.editRest.value = w.rest;
        this.els.editRounds.value = w.rounds;
      }
    } else {
      this.els.editName.value = getUniqueName(
        t("tabata"),
        this.workouts,
        "name",
      );
      this.els.editWork.value = 20;
      this.els.editRest.value = 10;
      this.els.editRounds.value = 8;
    }
    setTimeout(() => this.els.editName?.focus(), 300);
  },

  saveWorkout() {
    let finalName = this.els.editName.value.trim();
    if (!finalName)
      finalName = getUniqueName(t("tabata"), this.workouts, "name");

    if (finalName.length > 50) {
      updateText(this.els.nameError, t("name_too_long"));
      this.els.nameError?.classList.remove("hidden");
      this.els.editName.classList.add("animate-shake");
      setTimeout(
        () => this.els.editName.classList.remove("animate-shake"),
        300,
      );
      return;
    }

    const exists = this.workouts.some(
      (w) =>
        w.name.toLowerCase() === finalName.toLowerCase() &&
        w.id !== this.editingWorkoutId,
    );
    if (exists) {
      updateText(this.els.nameError, t("name_exists"));
      this.els.nameError?.classList.remove("hidden");
      this.els.editName.classList.add("animate-shake");
      setTimeout(
        () => this.els.editName.classList.remove("animate-shake"),
        300,
      );
      return;
    }
    const w = Math.max(1, parseInt(this.els.editWork.value) || 20),
      r = Math.max(1, parseInt(this.els.editRest.value) || 10),
      rnd = Math.max(1, parseInt(this.els.editRounds.value) || 8);
    let workoutIdToSelect = this.editingWorkoutId;
    if (this.editingWorkoutId) {
      const index = this.workouts.findIndex(
        (x) => x.id === this.editingWorkoutId,
      );
      if (index !== -1)
        this.workouts[index] = {
          ...this.workouts[index],
          name: finalName,
          work: w,
          rest: r,
          rounds: rnd,
        };
    } else {
      const newW = {
        id: Date.now(),
        name: finalName,
        work: w,
        rest: r,
        rounds: rnd,
      };
      this.workouts.push(newW);
      workoutIdToSelect = newW.id;
    }
    safeSetLS("tb_workouts", JSON.stringify(this.workouts));
    this.renderList();
    this.selectWorkout(workoutIdToSelect);
    modalManager.closeCurrent();
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

    const detailsText = `${w.work}${t("sec").toLowerCase()} / ${w.rest}${t("sec").toLowerCase()} • ${w.rounds} ${t("rds")}`;
    updateText(this.els.activeDetail, detailsText);
    this.renderList();
  },

  renderList() {
    if (!this.els.list) return;
    this.els.list.replaceChildren();

    const fragment = document.createDocumentFragment();
    const template = $("tb-workout-template");
    if (!template) return;

    this.workouts.forEach((w) => {
      const clone = template.content.cloneNode(true);
      const workoutElement = clone.firstElementChild;
      const isAct = w.id === this.selectedId;

      workoutElement.classList.toggle("app-surface", !isAct);
      workoutElement.classList.toggle("border", !isAct);
      workoutElement.classList.toggle("app-border", !isAct);
      workoutElement.classList.toggle("shadow-sm", !isAct);

      workoutElement.classList.toggle("app-surface", isAct);
      workoutElement.classList.toggle("border-2", isAct);
      workoutElement.classList.toggle("border-[var(--primary-color)]", isAct);
      workoutElement.classList.toggle("shadow-md", isAct);

      workoutElement.dataset.id = w.id;
      workoutElement.querySelector('[data-template-id="editBtn"]').dataset.id =
        w.id;
      workoutElement.querySelector(
        '[data-template-id="deleteBtn"]',
      ).dataset.id = w.id;

      const nameEl = workoutElement.querySelector('[data-template="name"]');
      nameEl.textContent = w.name;
      nameEl.classList.toggle("primary-text", isAct);
      nameEl.classList.toggle("app-text", !isAct);

      const detailsText = `${w.work}${t("sec").toLowerCase()} / ${w.rest}${t("sec").toLowerCase()} • ${w.rounds} ${t("rds")}`;
      workoutElement.querySelector('[data-template="details"]').textContent =
        detailsText;

      workoutElement
        .querySelector('[data-template-id="editBtn"]')
        .setAttribute("aria-label", t("edit"));
      workoutElement
        .querySelector('[data-template-id="deleteBtn"]')
        .setAttribute("aria-label", t("delete"));

      fragment.appendChild(workoutElement);
    });

    this.els.list.appendChild(fragment);
  },

  toggle() {
    sm.vibrate(40, "light");
    sm.play("click");
    sm.unlock();
    if (this.status === "STOPPED") this.start();
    else if (this.paused) this.resume();
    else this.pause();
  },

  start() {
    store.activate("tabata");

    const workout = this.workouts.find((w) => w.id === this.selectedId);
    if (workout && this.els.runningWorkoutName) {
      updateText(this.els.runningWorkoutName, workout.name);
    }

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
    startTimerContext();
    this.updatePhaseStyles();
    bgWorker.postMessage({ command: "start" });
    this.tick();
  },

  pause() {
    store.clearActiveTimer();
    this.paused = true;
    bgWorker.postMessage({ command: "stop" });
    if (this.rAF) cancelAnimationFrame(this.rAF);
    this.rAF = null;
    this.remainingAtPause = this.phaseEndTime - performance.now();
    updateText(this.els.status, t("pause"));
    stopTimerContext();
  },

  resume() {
    store.activate("tabata");
    this.paused = false;
    this.phaseEndTime = performance.now() + this.remainingAtPause;
    this.lastBeepSec = 0;
    startTimerContext();
    bgWorker.postMessage({ command: "start" });
    this.tick();
    this.updatePhaseStyles();
  },

  stop() {
    sm.vibrate(30, "medium");
    sm.play("click");
    store.clearActiveTimer();

    if (this.els.runningWorkoutName) {
      updateText(this.els.runningWorkoutName, "");
    }

    bgWorker.postMessage({ command: "stop" });
    if (this.rAF) cancelAnimationFrame(this.rAF);
    this.rAF = null;
    this.status = "STOPPED";
    this.paused = false;
    stopTimerContext();
    this.els.listSection.classList.remove("hidden");
    this.els.runningControls.classList.remove("flex");
    this.els.runningControls.classList.add("hidden");
    this.els.status.classList.add("hidden");
    updateText(this.els.timer, "GO");
    this.els.timer.classList.add("is-go");
    if (this.els.ring) this.els.ring.style.strokeDashoffset = this.ringLength;
  },

  tick(isBackground = false) {
    if (this.status === "STOPPED" || this.paused) return;
    const now = performance.now(),
      rem = this.phaseEndTime - now;
    if (rem <= 0) {
      const isDeepSleepWakeup = rem < -2000;
      this.nextPhase(isDeepSleepWakeup ? Math.abs(rem) : 0);
      return;
    }
    if (now - this.lastRender >= 16 || isBackground) {
      if (!isBackground) this.render(rem);
      else {
        updateTitle(`${this.status}: ${formatTime(rem)}`);
      }
      this.lastRender = now;
    }
    if (!isBackground) {
      if (this.rAF) cancelAnimationFrame(this.rAF);
      this.rAF = requestAnimationFrame(() => this.tick());
    }
  },

  advancePhase() {
    if (this.status === "READY") {
      this.status = "WORK";
      this.phaseDuration = this.work;
      sm.play("work_start");
    } else if (this.status === "WORK") {
      if (this.currentRound >= this.rounds) {
        return "complete";
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
    return "ok";
  },

  applyMissedTime(missedTime) {
    let remainingMissed = missedTime;
    while (remainingMissed > 0 && this.status !== "STOPPED") {
      const currentPhaseDuration =
        this.status === "READY"
          ? this.phaseDuration
          : this.status === "WORK"
            ? this.work
            : this.rest;
      const step = Math.min(remainingMissed, currentPhaseDuration);
      remainingMissed -= step;
      const leftInPhase = currentPhaseDuration - step;
      if (leftInPhase <= 0) {
        const result = this.advancePhase();
        if (result === "complete") {
          this.stop();
          return false;
        }
        if (remainingMissed === 0) {
          this.phaseDuration = this.phaseDuration + leftInPhase;
        }
      } else {
        this.phaseDuration = leftInPhase;
      }
    }
    return true;
  },

  nextPhase(missedTime = 0) {
    if (missedTime === 0) sm.vibrate([100, 50, 100], "strong");
    this.lastBeepSec = 0;

    if (missedTime > 0) {
      const shouldContinue = this.applyMissedTime(missedTime);
      if (!shouldContinue) return;
      this.phaseEndTime = performance.now() + this.phaseDuration;
    } else {
      const result = this.advancePhase();
      if (result === "complete") {
        sm.vibrate([200, 100, 200, 100, 400]);
        sm.play("complete");
        announceToScreenReader(t("tabata_complete"));
        requestAnimationFrame(() => {
          showToast(t("tabata_complete"));
          this.stop();
        });
        return;
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

    statusEl.classList.remove(
      "primary-vivid-text",
      "secondary-accent-text",
      "app-text-sec",
      "primary-text",
    );
    this.els.ring.classList.remove(
      "primary-vivid-stroke",
      "secondary-accent-stroke",
      "primary-stroke",
    );

    if (this.status === "WORK") {
      updateText(statusEl, t("work"));
      statusEl.classList.add("primary-text");
      this.els.ring.classList.add("primary-stroke");
    } else if (this.status === "REST") {
      updateText(statusEl, t("rest"));
      statusEl.classList.add("secondary-accent-text");
      this.els.ring.classList.add("secondary-accent-stroke");
    } else {
      updateText(statusEl, t("get_ready"));
      statusEl.classList.add("primary-text");
      this.els.ring.classList.add("primary-stroke");
    }
  },

  render(rem) {
    const sTotal = Math.ceil(rem / 1000);
    if (sTotal <= 3 && sTotal > 0 && this.lastBeepSec !== sTotal) {
      sm.play("tick");
      this.lastBeepSec = sTotal;
    }

    const timeStr = formatTime(rem);
    updateText(this.els.timer, timeStr);
    updateTitle(`${this.status}: ${timeStr}`);

    if (this.els.ring)
      this.els.ring.style.strokeDashoffset =
        this.ringLength -
        (Math.max(0, this.phaseDuration - rem) / this.phaseDuration) *
          this.ringLength;
  },
};
