// Файл: www/js/core/timer-engine.js

function clampMs(v) {
  const n = Number(v) || 0;
  return Math.max(0, Math.round(n));
}

export function createCountdownEngine({
  now = () => Date.now(),
  rebaseThresholdMs = 220,
} = {}) {
  let status = "idle"; // idle | running | paused
  let totalMs = 0;
  let remainingMs = 0;
  let targetEpochMs = 0;

  function getRemaining() {
    if (status === "running") {
      return Math.max(0, targetEpochMs - now());
    }
    return remainingMs;
  }

  function snapshot(extra = {}) {
    return {
      status,
      totalMs,
      remainingMs: getRemaining(),
      targetEpochMs: status === "running" ? targetEpochMs : 0,
      ...extra,
    };
  }

  function start(durationMs) {
    const duration = Math.max(1, clampMs(durationMs));
    totalMs = duration;
    remainingMs = duration;
    targetEpochMs = now() + duration;
    status = "running";
    return snapshot();
  }

  function pause() {
    if (status !== "running") return snapshot();
    remainingMs = getRemaining();
    targetEpochMs = 0;
    status = "paused";
    return snapshot();
  }

  function resume() {
    if (status !== "paused") return snapshot();
    targetEpochMs = now() + remainingMs;
    status = "running";
    return snapshot();
  }

  function stop() {
    status = "idle";
    totalMs = 0;
    remainingMs = 0;
    targetEpochMs = 0;
    return snapshot();
  }

  function adjust(deltaMs) {
    const delta = Math.round(Number(deltaMs) || 0);

    const baseRemaining = getRemaining();
    const nextRemaining = Math.max(0, baseRemaining + delta);
    const nextTotal = Math.max(1, totalMs + delta);

    totalMs = nextTotal;
    remainingMs = nextRemaining;

    if (status === "running") {
      targetEpochMs = now() + nextRemaining;
    }

    return snapshot();
  }

  function rebaseFromWorker(workerRemainingMs) {
    const workerRem = clampMs(workerRemainingMs);
    const predicted = getRemaining();

    const shouldRebase =
      status === "running" &&
      Math.abs(predicted - workerRem) > Math.max(0, rebaseThresholdMs);

    if (shouldRebase) {
      remainingMs = workerRem;
      targetEpochMs = now() + workerRem;
      return snapshot({ rebased: true });
    }

    return snapshot({ rebased: false });
  }

  function setPausedRemaining(ms) {
    remainingMs = clampMs(ms);
    if (status !== "running") {
      status = "paused";
      targetEpochMs = 0;
    }
    return snapshot();
  }

  function getStatus() {
    return status;
  }

  return {
    start,
    pause,
    resume,
    stop,
    adjust,
    rebaseFromWorker,
    setPausedRemaining,
    getRemaining,
    getStatus,
    snapshot,
  };
}
