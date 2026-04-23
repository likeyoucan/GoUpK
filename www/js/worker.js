/**
 * worker.js
 * Фоновый Web Worker для обеспечения непрерывной работы таймеров,
 * даже когда основная вкладка неактивна.
 *
 * Принимает два формата сообщений:
 * 1. Объекты для таймера обратного отсчета (требует точного расчета времени):
 *    { command: 'start', time: <ms> }
 *    { command: 'stop' }
 *    { command: 'reset' }
 *    { command: 'adjust', time: <ms_delta> }
 *
 * 2. Строки для секундомера и табаты (требуется простое "сердцебиение"):
 *    'start'
 *    'stop'
 */

// --- Константы ---
const COUNTDOWN_INTERVAL = 100; // мс, для плавного таймера обратного отсчета
const HEARTBEAT_INTERVAL = 1000; // мс, для тиков раз в секунду

// --- Состояние воркера ---
let intervalId = null;       // ID текущего интервала, null если воркер остановлен
let remainingTime = 0;       // Оставшееся время для таймера обратного отсчета
let lastTickTime = 0;        // Временная метка последнего тика для точного расчета

// --- Основные функции ---

/**
 * Останавливает любой активный интервал и сбрасывает его ID.
 */
function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Функция "тика" для таймера обратного отсчета.
 * Вычисляет прошедшее время с последнего вызова для точности.
 */
function countdownTick() {
  const now = performance.now();
  const elapsed = now - lastTickTime;
  lastTickTime = now;
  remainingTime -= elapsed;

  if (remainingTime <= 0) {
    remainingTime = 0;
    self.postMessage({ type: "tick", time: 0 });
    stopInterval();
  } else {
    self.postMessage({ type: "tick", time: remainingTime });
  }
}

/**
 * Функция "тика" для секундомера и табаты.
 * Просто отправляет сигнал "tick" каждую секунду.
 */
function heartbeatTick() {
  self.postMessage("tick");
}

// --- Обработчик входящих сообщений ---

self.onmessage = function (e) {
  const messageData = e.data;

  // --- Логика для ТАЙМЕРА (сообщения в виде объекта) ---
  if (typeof messageData === "object" && messageData.command) {
    const { command, time } = messageData;

    switch (command) {
      case "start":
        // Запускаем только если еще не запущен
        if (!intervalId) {
          remainingTime = time;
          lastTickTime = performance.now();
          intervalId = setInterval(countdownTick, COUNTDOWN_INTERVAL);
        }
        break;

      case "stop":
        stopInterval();
        break;
        
      case "reset":
        stopInterval();
        remainingTime = 0;
        break;

      case "adjust":
        // Корректируем время, только если таймер активен
        if (intervalId) {
          remainingTime += time;
          if (remainingTime < 0) {
            remainingTime = 0;
          }
          // Немедленно отправляем обновленное время в основной поток
          self.postMessage({ type: "tick", time: remainingTime });
        }
        break;
    }
  }
  
  // --- Логика для СЕКУНДОМЕРА и ТАБАТЫ (сообщения в виде строки) ---
  else if (typeof messageData === "string") {
    const command = messageData;

    if (command === "start") {
      // Запускаем только если еще не запущен
      if (!intervalId) {
        intervalId = setInterval(heartbeatTick, HEARTBEAT_INTERVAL);
      }
    } else if (command === "stop") {
      stopInterval();
    }
  }
};