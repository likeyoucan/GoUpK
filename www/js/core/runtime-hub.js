// Файл: www/js/core/runtime-hub.js

export function createRuntimeHub() {
  const modules = [];
  let started = false;

  return {
    register(name, initFn, destroyFn = null) {
      modules.push({ name, initFn, destroyFn });
    },

    start() {
      if (started) return;

      modules.forEach((m) => {
        try {
          m.initFn?.();
        } catch (err) {
          console.error(`[runtime-hub.start:${m.name}]`, err);
        }
      });

      started = true;
    },

    stop() {
      if (!started) return;

      [...modules].reverse().forEach((m) => {
        try {
          m.destroyFn?.();
        } catch (err) {
          console.error(`[runtime-hub.stop:${m.name}]`, err);
        }
      });

      started = false;
    },
  };
}
