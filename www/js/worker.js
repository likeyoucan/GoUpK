let intervalId = null;

self.addEventListener("message", (e) => {
  const command = e.data;

  if (command === "start") {
    if (!intervalId) {
      intervalId = setInterval(() => {
        self.postMessage("tick");
      }, 1000);
    }
  } else if (command === "stop") {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
});