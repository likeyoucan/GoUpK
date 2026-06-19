// Файл: www/js/theme/theme-events.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { onAppEvent } from "../events/app-events.js?v=VERSION";

export function bindThemeEvents(manager) {
  const unsubs = [];

  if (typeof manager.onSystemThemeChanged === "function") {
    unsubs.push(manager.onSystemThemeChanged());
  }

  unsubs.push(
    onAppEvent(APP_EVENTS.LANGUAGE_CHANGED, () => {
      manager.refreshThemeSelectTexts();
    }),
  );

  unsubs.push(
    onAppEvent(APP_EVENTS.ADAPTIVE_BG_CHANGED, () => {
      document.body.classList.add("is-updating-theme");
      manager.setMode(manager.currentMode, false);
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
    }),
  );

  unsubs.push(
    onAppEvent(APP_EVENTS.COLOR_SELECTED, (e) => {
      const { type, color, fromPicker } = e.detail;
      if (type === "accent") manager.setColor(color, !fromPicker);
      else manager.setBgColor(color, !fromPicker);
    }),
  );

  unsubs.push(
    onAppEvent(APP_EVENTS.COLOR_DELETED, (e) => {
      const { type, color } = e.detail;

      if (type === "accent") {
        const isDeletedActive =
          String(manager.currentAccent).toLowerCase() ===
          String(color).toLowerCase();

        manager._history.removeFromHistory("accent", color);

        if (isDeletedActive) {
          const fallback = manager.getLastValidColor("accent");
          manager.setColor(fallback || "default", true, {
            recordHistory: false,
            skipProCheck: true,
          });
        }
      } else if (type === "bg") {
        const isDeletedActive =
          String(manager.currentBg).toLowerCase() ===
          String(color).toLowerCase();

        manager._history.removeFromHistory("bg", color);

        if (isDeletedActive) {
          const fallback = manager.getLastValidColor("bg");
          manager.setBgColor(fallback || "default", true, {
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
