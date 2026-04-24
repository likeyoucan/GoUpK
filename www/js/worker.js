// Файл: www/js/worker.js (Финальная исправленная версия)

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
  self.postMessage({ type: "tick" });
}

self.onmessage = function (e) {
  // ИСПРАВЛЕНИЕ (Пункт #3): Единый API на основе объектов
  const { command, payload } = e.data;
  if (!command) return;

  switch (command) {
    case "start":
      if (!intervalId) {
        if (payload && typeof payload.time === "number") {
          // Это таймер обратного отсчета
          remainingTime = payload.time;
          lastTickTime = performance.now();
          intervalId = setInterval(countdownTick, 100);
        } else {
          // Это секундомер или табата
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
      if (command === "reset") {
        remainingTime = 0;
      }
      break;

    case "adjust":
      if (intervalId && payload && typeof payload.time === "number") {
        remainingTime += payload.time;
        if (remainingTime < 0) remainingTime = 0;
        self.postMessage({ type: "tick", time: remainingTime });
      }
      break;
  }
};
