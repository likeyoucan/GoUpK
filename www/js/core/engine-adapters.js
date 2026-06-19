// Файл: www/js/core/engine-adapters.js

export function applyTimerEngineSnapshot(tm, snap) {
  if (!tm || !snap) return;

  tm.timeRemainingMs = Math.max(0, Number(snap.remainingMs) || 0);
  tm.targetEpochMs = Number(snap.targetEpochMs) || 0;

  if ((Number(snap.totalMs) || 0) > 0) {
    tm.totalDuration = Number(snap.totalMs);
  }
}

export function applyStopwatchEngineSnapshot(sw, snap) {
  if (!sw || !snap) return;

  sw.elapsedTime = Math.max(0, Number(snap.elapsedMs) || 0);
  sw.startEpochMs = Number(snap.startEpochMs) || 0;
  sw.isRunning = !!snap.running;
}

export function applyTabataEngineSnapshot(tb, snap) {
  if (!tb || !snap) return;

  tb.status = String(snap.status || "STOPPED");
  tb.currentRound = Math.max(1, Number(snap.currentRound) || 1);
  tb.phaseDuration = Math.max(0, Number(snap.phaseDuration) || 0);
  tb.phaseEndTime = Math.max(0, Number(snap.phaseEndTime) || 0);
}