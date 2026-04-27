// Файл: www/js/tabata.js

import { $, adjustVal, formatTime } from "./utils.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

import { setupTabataRender } from "./tabata/tabata-render.js?v=VERSION";
import { setupTabataPhases } from "./tabata/tabata-phases.js?v=VERSION";
import { setupTabataWorkouts } from "./tabata/tabata-workouts.js?v=VERSION";
import { setupTabataCore } from "./tabata/tabata-core.js?v=VERSION";

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
  formatTime,

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

    setupTabataRender(this);
    setupTabataPhases(this);
    setupTabataWorkouts(this);
    setupTabataCore(this);

    this.bindCoreEvents();
    this.bindWorkoutEvents();

    document.querySelectorAll("[data-tb-adj]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        sm.vibrate(20, "light");
        const [id, delta] = e.currentTarget
          .getAttribute("data-tb-adj")
          .split(",");
        adjustVal(id, parseInt(delta, 10));
      }),
    );

    this.loadWorkoutsFromStorage();
  },
};
