// ===== worker.js (ОБНОВЛЕННАЯ ВЕРСИЯ) =====

// Web Worker для точного фонового отсчета времени.
// Web Worker работает в изолированном потоке и позволяет обходить это ограничение.

let intervalId = null;

self.addEventListener("message", (e) => {
  const command = e.data;

  // ИЗМЕНЕНО: Используем switch для лучшей читаемости и масштабируемости
  switch (command) {
    case "start":
      // Предотвращаем случайное создание нескольких параллельных интервалов
      if (!intervalId) {
        intervalId = setInterval(() => {
          self.postMessage("tick");
        }, 1000); // ИЗМЕНЕНО: 500ms -> 1000ms. Экономим батарею.
      }
      break;

    case "stop":
      // Очищаем интервал и освобождаем память
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      break;

    default:
      console.warn("Unknown command received in worker:", command);
      break;
  }
});