// Файл: www/js/bootstrap/disposer-bag.js

// Централизованное хранилище cleanup-функций.
// Позволяет гарантированно снимать все listeners/timers при destroy.
export function createDisposerBag() {
  const stack = [];

  return {
    add(disposer) {
      if (typeof disposer === "function") stack.push(disposer);
      return disposer;
    },

    run() {
      while (stack.length) {
        const fn = stack.pop();
        try {
          fn?.();
        } catch (err) {
          console.error("[dispose]", err);
        }
      }
    },
  };
}
