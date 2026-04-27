// Файл: www/js/theme/theme-color-history.js

function norm(v) {
  return String(v || "").toLowerCase();
}

export function createColorHistory(limit = 20) {
  const accent = [];
  const bg = [];

  const getStack = (type) => (type === "accent" ? accent : bg);

  function reset() {
    accent.length = 0;
    bg.length = 0;
  }

  function remember(type, previousColor, nextColor) {
    if (!previousColor) return;

    const prev = norm(previousColor);
    const next = norm(nextColor);
    if (!prev || prev === next) return;

    const stack = getStack(type);
    const last = stack[stack.length - 1];
    if (norm(last) === prev) return;

    stack.push(previousColor);
    if (stack.length > limit) {
      stack.splice(0, stack.length - limit);
    }
  }

  function removeFromHistory(type, color) {
    const stack = getStack(type);
    const target = norm(color);

    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (norm(stack[i]) === target) {
        stack.splice(i, 1);
      }
    }
  }

  function getLastValid(type, availableSet) {
    const stack = getStack(type);

    while (stack.length > 0) {
      const candidate = stack.pop();
      if (availableSet.has(norm(candidate))) {
        return candidate;
      }
    }

    return null;
  }

  return {
    reset,
    remember,
    removeFromHistory,
    getLastValid,
  };
}