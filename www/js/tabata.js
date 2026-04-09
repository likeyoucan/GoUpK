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
      modal: $("tb-modal"),
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
    };

    if (this.els.ring) {
      this.els.ring.style.strokeDasharray = this.ringLength;
      this.els.ring.style.strokeDashoffset = this.ringLength;
    }

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
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.workouts = parsed;
        } else {
          throw new Error("Invalid Array");
        }
      } else {
        throw new Error("No data");
      }
    } catch (e) {
      console.warn("Failed to parse tabata workouts", e);
      this.workouts = [
        { id: 1, name: "Tabata 1", work: 20, rest: 10, rounds: 8 },
      ];
      safeSetLS("tb_workouts", JSON.stringify(this.workouts));
    }

    let lastSelectedId = safeGetLS("tb_selected_id");
    if (lastSelectedId) lastSelectedId = Number(lastSelectedId);

    const exists = this.workouts.find((w) => w.id === lastSelectedId);
    if (exists) {
      this.selectWorkout(lastSelectedId);
    } else {
      this.selectWorkout(this.workouts[0].id);
    }

    this.renderList();

    this.els.startBtn?.addEventListener("click", () => this.toggle());
    this.els.stopBtn?.addEventListener("click", () => this.stop());

    $("tb-openModalBtn")?.addEventListener("click", () => this.openModal(null));
    $("tb-closeModalBtn")?.addEventListener("click", () => this.closeModal());

    this.els.editName?.addEventListener("input", () =>
      this.els.nameError?.classList.add("hidden")
    );

    document.querySelectorAll("[data-tb-adj]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const [id, delta] = e.currentTarget
          .getAttribute("data-tb-adj")
          .split(",");
        adjustVal(id, parseInt(delta));
      });
    });

    this.els.list?.addEventListener("click", (e) => {
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
    });

    this.els.list?.addEventListener("keydown", (e) => {
      const row = e.target.closest(".tb-workout-row");
      if (e.key === "Enter" && row) this.selectWorkout(Number(row.dataset.id));
    });

    bgWorker.addEventListener("message", (e) => {
      if (
        e.data === "tick" &&
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
    this.els.nameError?.classList.add("hidden");
    this.editingWorkoutId = idToEdit;

    if (idToEdit) {
      const w = this.workouts.find((x) => x.id === idToEdit);
      if (w) {
        this.els.editName.value = w.name;
        this.els.editWork.value = w.work;
        this.els.editRest.value = w.rest;
        this.els.editRounds.value = w.rounds;
      }
    } else {
      this.els.editName.value = this.getUniqueName(t("tabata"));
      this.els.editWork.value = 20;
      this.els.editRest.value = 10;
      this.els.editRounds.value = 8;
    }

    this.els.modal.classList.remove("hidden");
    this.els.modal.classList.add("flex");
    this.els.modal.removeAttribute("inert");
    this.els.modal.removeAttribute("aria-hidden");

    void this.els.modal.offsetWidth;

    this.els.modal.classList.remove("translate-y-full");
    this.els.modal.classList.add("translate-y-0");

    setTimeout(() => this.els.editName.focus(), 300);
  },

  closeModal() {
    if (document.activeElement === this.els.editName) {
      this.els.editName.blur();
    }

    this.els.modal.classList.remove("translate-y-0");
    this.els.modal.classList.add("translate-y-full");

    setTimeout(() => {
      this.els.modal.classList.add("hidden");
      this.els.modal.classList.remove("flex");
      this.els.modal.setAttribute("inert", "");
      this.els.modal.setAttribute("aria-hidden", "true");
      this.editingWorkoutId = null;
    }, 400);
  },

  saveWorkout() {
    let finalName = this.els.editName.value.trim();
    if (!finalName) finalName = this.getUniqueName(t("tabata"));

    const exists = this.workouts.some(
      (w) =>
        w.name.toLowerCase() === finalName.toLowerCase() &&
        w.id !== this.editingWorkoutId
    );

    if (exists) {
      this.els.nameError?.classList.remove("hidden");
      this.els.editName.classList.add("animate-shake");
      setTimeout(
        () => this.els.editName.classList.remove("animate-shake"),
        300
      );
      return;
    }

    const w = Math.max(1, parseInt(this.els.editWork.value) || 20);
    const r = Math.max(1, parseInt(this.els.editRest.value) || 10);
    const rnd = Math.max(1, parseInt(this.els.editRounds.value) || 8);

    if (this.editingWorkoutId) {
      const index = this.workouts.findIndex(
        (x) => x.id === this.editingWorkoutId
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
    updateText(
      this.els.activeDetail,
      `${w.work}${t("sec").toLowerCase()} / ${w.rest}${t(
        "sec"
      ).toLowerCase()} • ${w.rounds} ${t("rounds")}`
    );
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
      div.className = `tb-workout-row p-4 rounded-xl flex justify-between items-center transition-all cursor-pointer mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] ${
        isAct
          ? "app-surface border-2 border-[var(--primary-color)] shadow-md"
          : "app-surface border border-transparent shadow-sm"
      }`;
      div.dataset.id = w.id;

      div.innerHTML = `
        <div class="flex-1">
          <div class="font-bold app-text ${
            isAct ? "primary-text" : ""
          }">${escapeHTML(w.name)}</div>
          <div class="text-xs app-text-sec mt-1">${w.work}${t(
        "sec"
      ).toLowerCase()} / ${w.rest}${t("sec").toLowerCase()} • ${w.rounds} ${t(
        "rds"
      )}</div>
        </div>
        <div class="flex gap-1 shrink-0">
          <button type="button" aria-label="${t("edit")}" data-id="${
        w.id
      }" class="tb-edit-btn text-gray-400 hover:primary-text p-2 focus:outline-none custom-focus rounded-lg active:scale-95">
            <svg focusable="false" aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
          </button>
          <button type="button" aria-label="${t("delete")}" data-id="${
        w.id
      }" class="tb-del-btn text-red-500 opacity-50 hover:opacity-100 p-2 focus:outline-none custom-focus rounded-lg active:scale-95">
            <svg focusable="false" aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>`;
      fragment.appendChild(div);
    });
    this.els.list.appendChild(fragment);
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
      new CustomEvent("timerStarted", { detail: "tabata" })
    );
    this.currentRound = 1;
    this.status = "READY";
    this.phaseDuration = 5000;
    this.phaseEndTime = performance.now() + this.phaseDuration;
    this.paused = false;
    this.lastBeepSec = 0;
    this.els.listSection.classList.add("hidden");
    this.els.runningControls.classList.replace("hidden", "flex");
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
      new CustomEvent("timerStarted", { detail: "tabata" })
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
    this.els.runningControls.classList.replace("flex", "hidden");
    this.els.status.classList.add("hidden");
    updateText(this.els.timer, "GO");
    this.els.timer.classList.add("is-go");
    this.els.ring.style.strokeDashoffset = this.ringLength;
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

    if (!isBackground) this.rAF = requestAnimationFrame(() => this.tick());
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
    updateText(this.els.roundDisplay, this.currentRound);
    this.els.ring.classList.remove(
      "primary-stroke",
      "text-blue-500",
      "text-gray-500"
    );
    this.els.ring.style.stroke = "";

    if (this.status === "WORK") {
      updateText(this.els.status, t("work"));
      this.els.status.className =
        "text-xl font-bold uppercase tracking-widest mb-1 primary-text";
      this.els.ring.classList.add("primary-stroke");
    } else if (this.status === "REST") {
      updateText(this.els.status, t("rest"));
      this.els.status.className =
        "text-xl font-bold uppercase tracking-widest mb-1 text-blue-500";
      this.els.ring.style.stroke = "#3b82f6";
    } else {
      updateText(this.els.status, t("get_ready"));
      this.els.status.className =
        "text-xl font-bold uppercase tracking-widest mb-1 app-text-sec";
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
    this.els.ring.style.strokeDashoffset =
      this.ringLength -
      (Math.max(0, this.phaseDuration - rem) / this.phaseDuration) *
        this.ringLength;
  },
};