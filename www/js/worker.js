// worker.js
// Web Worker для точного фонового отсчета времени.
// Web Worker работает в изолированном потоке и позволяет обходить это ограничение,
// отправляя "тики" в основной поток каждую секунду, чтобы обновлялся заголовок документа (Title) и шли звуки.

let intervalId = null;

self.addEventListener("message", (e) => {
  const command = e.data;

  if (command === "start") {
    // Предотвращаем случайное создание нескольких параллельных интервалов
    if (!intervalId) {
      intervalId = setInterval(() => {
        self.postMessage("tick");
      }, 1000); // Тикаем ровно раз в секунду
    }
  } else if (command === "stop") {
    // Очищаем интервал и освобождаем память
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
});
