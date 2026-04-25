// Файл: www/js/worker.js

let intervalId = null;
let remainingTime = 0;
let lastTickTime = 0;
let mode = "idle"; // idle | countdown | heartbeat

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function countdownTick() {
  if (mode !== "countdown") return;

  const now = performance.now();
  const elapsed = now - lastTickTime;
  lastTickTime = now;
  remainingTime -= elapsed;

  if (remainingTime <= 0) {
    remainingTime = 0;
    self.postMessage({ type: "tick", time: 0 });
    stopInterval();
    mode = "idle";
  } else {
    self.postMessage({ type: "tick", time: remainingTime });
  }
}

function heartbeatTick() {
  if (mode !== "heartbeat") return;
  self.postMessage({ type: "heartbeat" });
}

function startCountdown(time) {
  stopInterval();
  mode = "countdown";
  remainingTime = Math.max(0, Number(time) || 0);
  lastTickTime = performance.now();

  self.postMessage({ type: "tick", time: remainingTime });
  intervalId = setInterval(countdownTick, 100);
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
      remainingTime = 0;
      mode = "idle";
      break;

    case "adjust":
      if (mode === "countdown") {
        remainingTime += Number(time) || 0;
        if (remainingTime < 0) remainingTime = 0;
        self.postMessage({ type: "tick", time: remainingTime });
      }
      break;
  }
};
