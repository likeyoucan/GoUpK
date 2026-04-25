// Файл: www/js/worker.js

let intervalId = null;
let remainingTime = 0;
let lastTickTime = 0;

function countdownTick() {
  const now = performance.now();
  const elapsed = now - lastTickTime;
  lastTickTime = now;
  remainingTime -= elapsed;

  if (remainingTime <= 0) {
    remainingTime = 0;
    self.postMessage({ type: "tick", time: 0 });
    clearInterval(intervalId);
    intervalId = null;
  } else {
    self.postMessage({ type: "tick", time: remainingTime });
  }
}

function heartbeatTick() {
  self.postMessage({ type: "heartbeat" });
}

self.onmessage = function (e) {
  if (typeof e.data === "object" && e.data.command) {
    const { command, time } = e.data;
    switch (command) {
      case "start":
        if (time !== undefined) {
          if (!intervalId) {
            remainingTime = time;
            lastTickTime = performance.now();
            intervalId = setInterval(countdownTick, 100);
          }
        } else {
          if (!intervalId) {
            intervalId = setInterval(heartbeatTick, 1000);
          }
        }
        break;
      case "stop":
      case "reset":
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (command === "reset") remainingTime = 0;
        break;
      case "adjust":
        if (intervalId) {
          remainingTime += time;
          if (remainingTime < 0) remainingTime = 0;
          self.postMessage({ type: "tick", time: remainingTime });
        }
        break;
    }
  }
};
