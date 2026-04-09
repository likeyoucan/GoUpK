// worker.js

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