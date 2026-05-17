// Файл: www/js/worker.js

let intervalId = null;
let mode = "idle"; // idle | countdown | heartbeat
let endEpochMs = 0;

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function getRemainingMs() {
  return Math.max(0, endEpochMs - Date.now());
}

function countdownTick() {
  if (mode !== "countdown") return;

  const remaining = getRemainingMs();
  self.postMessage({ type: "tick", time: remaining });

  if (remaining <= 0) {
    stopInterval();
    mode = "idle";
  }
}

function heartbeatTick() {
  if (mode !== "heartbeat") return;
  self.postMessage({ type: "heartbeat" });
}

function startCountdown(time) {
  stopInterval();

  const duration = Math.max(0, Number(time) || 0);
  endEpochMs = Date.now() + duration;
  mode = "countdown";

  // Мгновенный первый тик
  self.postMessage({ type: "tick", time: getRemainingMs() });

  // 250ms достаточно для плавности и меньше риска throttle-боли в фоне
  intervalId = setInterval(countdownTick, 250);
}

function startHeartbeat() {
  stopInterval();
  mode = "heartbeat";
  intervalId = setInterval(heartbeatTick, 1000);
}

self.onmessage = function (e) {
  if (typeof e.data !== "object" || !e.data.command) return;

  const { command, time } = e.data;

  switch (command) {
    case "start":
      if (time !== undefined) {
        startCountdown(time);
      } else {
        startHeartbeat();
      }
      break;

    case "stop":
      stopInterval();
      mode = "idle";
      break;

    case "reset":
      stopInterval();
      endEpochMs = 0;
      mode = "idle";
      break;

    case "adjust":
      if (mode === "countdown") {
        endEpochMs += Number(time) || 0;
        if (endEpochMs < Date.now()) endEpochMs = Date.now();
        self.postMessage({ type: "tick", time: getRemainingMs() });
      }
      break;
  }
};
