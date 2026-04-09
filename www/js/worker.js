// worker.js
// Web Worker для точного фонового отсчета времени.
// Браузеры жестко троттлят (замедляют до 1 раза в минуту) setTimeout/setInterval в неактивных вкладках.
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
      }, 1000);
    }
  } else if (command === "stop") {
    // Очищаем интервал и освобождаем память
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
});
