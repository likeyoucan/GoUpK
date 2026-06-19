// Файл: www/js/core/runtime-reconcile.js

import {
  getRemainingMs,
  shouldRebaseTargetEpoch,
} from "./timers-runtime.js?v=VERSION";

export function shouldSkipWorkerTick({
  skipWorkerTickUntil = 0,
  nowPerf = performance.now(),
  workerRemainingMs = 0,
}) {
  return !!(
    skipWorkerTickUntil &&
    nowPerf < skipWorkerTickUntil &&
    workerRemainingMs > 0
  );
}

export function getRebasedTargetEpochFromWorker({
  targetEpochMs,
  workerRemainingMs,
  nowEpoch = Date.now(),
  thresholdMs = 220,
}) {
  const predicted = getRemainingMs(targetEpochMs, nowEpoch);

  if (
    shouldRebaseTargetEpoch({
      predictedRemainingMs: predicted,
      workerRemainingMs,
      thresholdMs,
    })
  ) {
    return nowEpoch + workerRemainingMs;
  }

  return targetEpochMs;
}

export function resolveRunningRemaining(targetEpochMs, nowEpoch = Date.now()) {
  return getRemainingMs(targetEpochMs, nowEpoch);
}

export function resolvePausedRemaining(
  remainingAtPause = 0,
  timeRemainingMs = 0,
) {
  return Math.max(0, Number(remainingAtPause) || Number(timeRemainingMs) || 0);
}
