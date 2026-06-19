// Файл: www/js/core/tabata-engine.js

function clampMs(v) {
  const n = Number(v) || 0;
  return Math.max(0, Math.round(n));
}

export function createTabataEngine({ now = () => Date.now() } = {}) {
  const plan = {
    workMs: 20_000,
    restMs: 10_000,
    rounds: 8,
    readyMs: 5_000,
  };

  const state = {
    status: "STOPPED", // STOPPED | READY | WORK | REST
    currentRound: 1,
    phaseDuration: 0,
    phaseEndTime: 0,
  };

  function snapshot(extra = {}) {
    return {
      status: state.status,
      currentRound: state.currentRound,
      phaseDuration: state.phaseDuration,
      phaseEndTime: state.phaseEndTime,
      ...extra,
    };
  }

  function configure({ workMs, restMs, rounds, readyMs } = {}) {
    if (workMs != null) plan.workMs = Math.max(1, clampMs(workMs));
    if (restMs != null) plan.restMs = Math.max(1, clampMs(restMs));
    if (rounds != null)
      plan.rounds = Math.max(1, Math.round(Number(rounds) || 1));
    if (readyMs != null) plan.readyMs = Math.max(1, clampMs(readyMs));
    return snapshot();
  }

  function startReady() {
    state.status = "READY";
    state.currentRound = 1;
    state.phaseDuration = plan.readyMs;
    state.phaseEndTime = now() + state.phaseDuration;
    return snapshot();
  }

  function stop() {
    state.status = "STOPPED";
    state.currentRound = 1;
    state.phaseDuration = 0;
    state.phaseEndTime = 0;
    return snapshot();
  }

  function getRemaining() {
    if (state.status === "STOPPED") return 0;
    return Math.max(0, state.phaseEndTime - now());
  }

  function pause() {
    return getRemaining();
  }

  function resume(remainingMs) {
    const rem = Math.max(0, clampMs(remainingMs));
    state.phaseEndTime = now() + rem;
    return snapshot();
  }

  function getPhaseDuration() {
    return state.phaseDuration;
  }

  function shortenCurrentPhase(deltaMs) {
    const cut = Math.max(0, clampMs(deltaMs));
    state.phaseDuration = Math.max(0, state.phaseDuration - cut);
    state.phaseEndTime = now() + state.phaseDuration;
    return snapshot();
  }

  function advanceOnce() {
    if (state.status === "STOPPED") {
      return { completed: false, snapshot: snapshot() };
    }

    if (state.status === "READY") {
      state.status = "WORK";
      state.phaseDuration = plan.workMs;
      state.phaseEndTime = now() + state.phaseDuration;
      return { completed: false, snapshot: snapshot() };
    }

    if (state.status === "WORK") {
      if (state.currentRound >= plan.rounds) {
        return { completed: true, snapshot: snapshot() };
      }

      state.status = "REST";
      state.phaseDuration = plan.restMs;
      state.phaseEndTime = now() + state.phaseDuration;
      return { completed: false, snapshot: snapshot() };
    }

    // REST -> WORK
    state.currentRound += 1;
    state.status = "WORK";
    state.phaseDuration = plan.workMs;
    state.phaseEndTime = now() + state.phaseDuration;
    return { completed: false, snapshot: snapshot() };
  }

  return {
    configure,
    startReady,
    stop,
    pause,
    resume,
    getRemaining,
    getPhaseDuration,
    shortenCurrentPhase,
    advanceOnce,
    snapshot,
  };
}
