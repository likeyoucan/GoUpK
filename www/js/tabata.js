// Файл: www/js/tabata.js

import { $, adjustVal, formatTime } from "./utils.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { createRingController } from "./ring/ring-controller.js?v=VERSION";

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
  // IMPORTANT: for Tabata this is now epoch milliseconds (Date.now base)
  phaseEndTime: 0,
  remainingAtPause: 0,
  rAF: null,
  lastRender: 0,
  paused: false,
  els: {},
  lastBeepSec: 0,
  editingWorkoutId: null,
  ringLength: 282.74,
  ringCtrl: null,

  // Phase marker to handle ring reset at phase boundaries without reverse sweep
  phaseStamp: 0,
  lastRenderedPhaseStamp: -1,

  // Completion guard (prevents repeated complete logic in background race)
  completionHandled: false,

  // Visual close-hold at phase edge (foreground only)
  phaseClosing: false,
  phaseCloseTimer: null,

  // Runtime unbind bridges
  _unbindRuntime: null,
  _unbindCoreEvents: null,
  _unbindBackgroundSync: null,
  _unbindWorkouts: null,

  formatTime,

  init() {
    this._unbindRuntime?.();
    this._unbindRuntime = null;

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

      this.ringCtrl?.stop?.();
      this.ringCtrl = createRingController({
        ringEl: this.els.ring,
        initialOffset: this.ringLength,
        alpha: 0.15,
      });
      this.ringCtrl.start();
    }

    setupTabataRender(this);
    setupTabataPhases(this);
    setupTabataWorkouts(this);
    setupTabataCore(this);

    this.bindCoreEvents();
    this.bindWorkoutEvents();

    const disposers = [];
    const bind = (el, event, handler, options) => {
      if (!el) return;
      el.addEventListener(event, handler, options);
      disposers.push(() => el.removeEventListener(event, handler, options));
    };

    const onAdjClick = (e) => {
      sm.vibrate(20, "light");
      const [id, delta] = e.currentTarget
        .getAttribute("data-tb-adj")
        .split(",");
      adjustVal(id, parseInt(delta, 10));
    };

    document.querySelectorAll("[data-tb-adj]").forEach((btn) => {
      bind(btn, "click", onAdjClick);
    });

    this.loadWorkoutsFromStorage();

    this._unbindRuntime = () => {
      if (this.rAF) {
        cancelAnimationFrame(this.rAF);
        this.rAF = null;
      }

      if (this.phaseCloseTimer) {
        clearTimeout(this.phaseCloseTimer);
        this.phaseCloseTimer = null;
      }

      this._unbindCoreEvents?.();
      this._unbindCoreEvents = null;

      this._unbindBackgroundSync?.();
      this._unbindBackgroundSync = null;

      this._unbindWorkouts?.();
      this._unbindWorkouts = null;

      disposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[tabata.dispose]", err);
        }
      });
    };
  },
};
