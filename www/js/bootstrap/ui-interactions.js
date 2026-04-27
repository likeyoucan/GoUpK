// Файл: www/js/bootstrap/ui-interactions.js

import { bindModalActions } from "./modal-bindings.js?v=VERSION";
import { bindKeyboardShortcuts } from "./keyboard-shortcuts.js?v=VERSION";
import { bindBottomNav } from "./navigation-bindings.js?v=VERSION";
import { bindNavSwipe } from "./navigation-gesture-controller.js?v=VERSION";
import { bindStopwatchDoubleTapLap } from "./stopwatch-gestures.js?v=VERSION";

export function bindUiInteractions({
  $,
  showToast,
  t,
  modalManager,
  themeManager,
  sm,
  langManager,
  sw,
  tm,
  tb,
  navigation,
}) {
  const unbinders = [];

  unbinders.push(
    bindModalActions({
      $,
      showToast,
      t,
      modalManager,
      themeManager,
      sm,
      langManager,
      sw,
      tb,
    }),
  );

  unbinders.push(
    bindKeyboardShortcuts({ navigation, modalManager, sw, tm, tb }),
  );

  unbinders.push(
    bindBottomNav({ navigation, modalManager, sm }),
  );

  unbinders.push(
    bindNavSwipe({
      appContainer: $("app"),
      bottomNav: $("app")?.querySelector("nav"),
      navigation,
      modalManager,
    }),
  );

  unbinders.push(
    bindStopwatchDoubleTapLap({ $, sw }),
  );

  return () => {
    unbinders.forEach((fn) => {
      if (typeof fn === "function") fn();
    });
  };
}