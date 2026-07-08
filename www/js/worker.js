// Файл: www/js/worker.jss

/**
 * @typedef {Object} WorkerCommandMessage
 * @property {"start"|"stop"|"reset"|"adjust"} command
 * @property {number} [time]
 */

const COMMANDS = Object.freeze({
  START: "start",
  STOP: "stop",
  RESET: "reset",
  ADJUST: "adjust",
});

const MODES = Object.freeze({
  IDLE: "idle",
  COUNTDOWN: "countdown",
  HEARTBEAT: "heartbeat",
});

let intervalId = null;
let mode = MODES.IDLE;
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
  if (mode !== MODES.COUNTDOWN) return;

  const remaining = getRemainingMs();
  self.postMessage({ type: "tick", time: remaining });

  if (remaining <= 0) {
    stopInterval();
    mode = MODES.IDLE;
  }
}

function heartbeatTick() {
  if (mode !== MODES.HEARTBEAT) return;
  self.postMessage({ type: "heartbeat" });
}

function startCountdown(time) {
  stopInterval();

  const duration = Math.max(0, Number(time) || 0);
  endEpochMs = Date.now() + duration;
  mode = MODES.COUNTDOWN;

  // Мгновенный первый тик
  self.postMessage({ type: "tick", time: getRemainingMs() });

  // 250ms достаточно для плавности и меньше риска throttle-боли в фоне
  intervalId = setInterval(countdownTick, 250);
}

function startHeartbeat() {
  stopInterval();
  mode = MODES.HEARTBEAT;
  intervalId = setInterval(heartbeatTick, 1000);
}

self.onmessage = function (e) {
  if (!e.data || typeof e.data !== "object" || !("command" in e.data)) return;

  /** @type {WorkerCommandMessage} */
  const data = e.data;
  const { command, time } = data;

  switch (command) {
    case COMMANDS.START:
      if (time !== undefined) {
        startCountdown(time);
      } else {
        startHeartbeat();
      }
      break;

    case COMMANDS.STOP:
      stopInterval();
      mode = MODES.IDLE;
      break;

    case COMMANDS.RESET:
      stopInterval();
      endEpochMs = 0;
      mode = MODES.IDLE;
      break;

    case COMMANDS.ADJUST:
      if (mode === MODES.COUNTDOWN) {
        endEpochMs += Number(time) || 0;
        if (endEpochMs < Date.now()) endEpochMs = Date.now();
        self.postMessage({ type: "tick", time: getRemainingMs() });
      }
      break;
  }
};
