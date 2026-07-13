// Файл: www/js/tabata/tabata-controller.js

import { $, adjustVal, formatTime } from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { createRingController } from "../ring/ring-controller.js?v=VERSION";
import { createTabataEngine } from "../core/tabata-engine.js?v=VERSION";

import { setupTabataRender } from "./tabata-render.js?v=VERSION";
import { setupTabataPhases } from "./tabata-phases.js?v=VERSION";
import { setupTabataWorkouts } from "./tabata-workouts.js?v=VERSION";
import { setupTabataCore } from "./tabata-core.js?v=VERSION";

/** @typedef {import("../types/app-contracts.js").TabataModule} TabataModule */

/** @type {TabataModule} */
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
  ringCtrl: null,

  tabataEngine: null,

  phaseStamp: 0,
  lastRenderedPhaseStamp: -1,

  completionHandled: false,

  phaseClosing: false,
  phaseCloseTimer: null,

  _unbindRuntime: null,
  _unbindCoreEvents: null,
  _unbindBackgroundSync: null,
  _unbindWorkouts: null,
  _unbindSummaryPlacement: null,

  formatTime,

  bindActiveSummaryPlacement() {
    this._unbindSummaryPlacement?.();
    this._unbindSummaryPlacement = null;

    const summary = this.els.activeSummary;
    const hostTop = this.els.activeSummaryHostTop;
    const hostMid = this.els.activeSummaryHostMid;

    if (!summary || !hostTop || !hostMid) return;

    const place = () => {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const target = isMobile ? hostTop : hostMid;
      if (summary.parentElement !== target) {
        target.appendChild(summary);
      }
    };

    let raf = 0;
    const onViewportChange = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        place();
      });
    };

    place();

    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("orientationchange", onViewportChange, {
      passive: true,
    });

    this._unbindSummaryPlacement = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);

      if (summary.parentElement !== hostMid) {
        hostMid.appendChild(summary);
      }
    };
  },

  init() {
    this._unbindRuntime?.();
    this._unbindRuntime = null;

    if (!this.tabataEngine) {
      this.tabataEngine = createTabataEngine({
        now: () => Date.now(),
      });
    }

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
      activeSummary: $("tb-active-summary"),
      activeSummaryHostTop: $("tb-active-summary-host-top"),
      activeSummaryHostMid: $("tb-active-summary-host-mid"),
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
    this.bindActiveSummaryPlacement();

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

      this._unbindSummaryPlacement?.();
      this._unbindSummaryPlacement = null;

      disposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[tabata.dispose]", err);
        }
      });

      this.phaseClosing = false;
      this.completionHandled = false;
    };
  },
};
