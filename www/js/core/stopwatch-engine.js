// Файл: www/js/core/stopwatch-engine.js

function clampMs(v) {
  const n = Number(v) || 0;
  return Math.max(0, Math.round(n));
}

export function createStopwatchEngine({ now = () => Date.now() } = {}) {
  let status = "idle"; // idle | running | paused
  let startEpochMs = 0;
  let elapsedMs = 0;

  function getElapsed() {
    if (status === "running") {
      return clampMs(now() - startEpochMs);
    }
    return elapsedMs;
  }

  function snapshot(extra = {}) {
    return {
      status,
      running: status === "running",
      startEpochMs: status === "running" ? startEpochMs : 0,
      elapsedMs: getElapsed(),
      ...extra,
    };
  }

  function start(fromElapsedMs = elapsedMs) {
    const baseElapsed = clampMs(fromElapsedMs);
    elapsedMs = baseElapsed;
    startEpochMs = now() - baseElapsed;
    status = "running";
    return snapshot();
  }

  function pause() {
    if (status !== "running") return snapshot();
    elapsedMs = getElapsed();
    startEpochMs = 0;
    status = "paused";
    return snapshot();
  }

  function reset() {
    status = "idle";
    startEpochMs = 0;
    elapsedMs = 0;
    return snapshot();
  }

  function setElapsed(nextElapsedMs) {
    const v = clampMs(nextElapsedMs);
    elapsedMs = v;
    if (status === "running") {
      startEpochMs = now() - v;
    }
    return snapshot();
  }

  function isRunning() {
    return status === "running";
  }

  return {
    start,
    pause,
    reset,
    setElapsed,
    getElapsed,
    isRunning,
    snapshot,
  };
}
