// worker.js

let intervalId = null;
let remainingTime = 0;
let lastTickTime = 0;

// Функция "тика" для таймера (countdown)
function countdownTick() {
  const now = performance.now();
  const elapsed = now - lastTickTime;
  lastTickTime = now;
  remainingTime -= elapsed;

  if (remainingTime <= 0) {
    remainingTime = 0;
    self.postMessage({ type: 'tick', time: 0 });
    clearInterval(intervalId);
    intervalId = null;
  } else {
    self.postMessage({ type: 'tick', time: remainingTime });
  }
}

// Функция "тика" для секундомера и табаты (просто "сердцебиение")
function heartbeatTick() {
  self.postMessage('tick');
}

self.onmessage = function (e) {
  // Логика для ТАЙМЕРА (команды в виде объекта)
  if (typeof e.data === 'object' && e.data.command) {
    const { command, time } = e.data;
    switch (command) {
      case 'start':
        if (!intervalId) {
          remainingTime = time;
          lastTickTime = performance.now();
          // Для таймера интервал чаще для плавности кольца
          intervalId = setInterval(countdownTick, 100);
        }
        break;
      case 'stop':
      case 'reset':
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (command === 'reset') remainingTime = 0;
        break;
      case 'adjust':
        if (intervalId) {
          remainingTime += time;
          if (remainingTime < 0) remainingTime = 0;
          // Немедленно отправляем обновленное время
          self.postMessage({ type: 'tick', time: remainingTime });
        }
        break;
    }
  }
  // Логика для СЕКУНДОМЕРА и ТАБАТЫ (команды в виде строки)
  else if (typeof e.data === 'string') {
    const command = e.data;
    if (command === 'start') {
      if (!intervalId) {
        // Для этих модулей 1 секунда достаточна
        intervalId = setInterval(heartbeatTick, 1000);
      }
    } else if (command === 'stop') {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  }
};