// Файл: www/js/theme/theme-events.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { onAppEvent } from "../events/app-events.js?v=VERSION";

function colorEquals(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

export function bindThemeEvents(manager) {
  const unsubs = [];

  if (typeof manager.onSystemThemeChanged === "function") {
    unsubs.push(manager.onSystemThemeChanged());
  }

  unsubs.push(
    onAppEvent(APP_EVENTS.LANGUAGE_CHANGED, () => {
      manager.refreshThemeSelectTexts?.();
    }),
  );

  unsubs.push(
    onAppEvent(APP_EVENTS.ADAPTIVE_BG_CHANGED, () => {
      document.body.classList.add("is-updating-theme");
      manager.setMode?.(manager.currentMode, false);
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
    }),
  );

  unsubs.push(
    onAppEvent(APP_EVENTS.COLOR_SELECTED, (e) => {
      const detail = e?.detail || {};
      const { type, color, fromPicker } = detail;
      if (!type || !color) return;

      if (type === "accent") manager.setColor?.(color, !fromPicker);
      else manager.setBgColor?.(color, !fromPicker);
    }),
  );

  unsubs.push(
    onAppEvent(APP_EVENTS.COLOR_DELETED, (e) => {
      const detail = e?.detail || {};
      const { type, color } = detail;
      if (!type || !color) return;

      if (type === "accent") {
        const isDeletedActive = colorEquals(manager.currentAccent, color);

        if (typeof manager.removeColorFromHistory === "function") {
          manager.removeColorFromHistory("accent", color);
        } else {
          manager._history?.removeFromHistory?.("accent", color);
        }

        if (isDeletedActive) {
          const fallback = manager.getLastValidColor?.("accent");
          manager.setColor?.(fallback || "default", true, {
            recordHistory: false,
            skipProCheck: true,
          });
        }
        return;
      }

      if (type === "bg") {
        const isDeletedActive = colorEquals(manager.currentBg, color);

        if (typeof manager.removeColorFromHistory === "function") {
          manager.removeColorFromHistory("bg", color);
        } else {
          manager._history?.removeFromHistory?.("bg", color);
        }

        if (isDeletedActive) {
          const fallback = manager.getLastValidColor?.("bg");
          manager.setBgColor?.(fallback || "default", true, {
            recordHistory: false,
            skipProCheck: true,
          });
        }
      }
    }),
  );

  return () => {
    unsubs.forEach((off) => {
      try {
        off?.();
      } catch (err) {
        console.error("[theme.events.dispose]", err);
      }
    });
  };
}
