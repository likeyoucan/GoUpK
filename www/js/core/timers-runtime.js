// Файл: www/js/core/timers-runtime.js

export function getRemainingMs(targetEpochMs, nowMs = Date.now()) {
  return Math.max(0, Number(targetEpochMs || 0) - Number(nowMs || 0));
}

export function getProgressOffset({ remainingMs, totalMs, ringLength }) {
  const safeTotal = Math.max(1, Number(totalMs) || 1);
  const safeRing = Number(ringLength) || 0;

  const progress = Math.max(
    0,
    Math.min(1, (Number(remainingMs) || 0) / safeTotal),
  );

  return safeRing * progress;
}

export function shouldRebaseTargetEpoch({
  predictedRemainingMs,
  workerRemainingMs,
  thresholdMs = 220,
}) {
  const predicted = Number(predictedRemainingMs) || 0;
  const worker = Number(workerRemainingMs) || 0;
  return Math.abs(predicted - worker) > Math.max(0, Number(thresholdMs) || 0);
}
