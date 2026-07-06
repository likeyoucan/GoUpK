// Файл: www/js/bootstrap/ui-interactions.js

import { bindModalActions } from "./modal-bindings.js?v=VERSION";
import { bindKeyboardShortcuts } from "./keyboard-shortcuts.js?v=VERSION";
import { bindBottomNav } from "./navigation-bindings.js?v=VERSION";
import { bindNavSwipe } from "./navigation-gesture-controller.js?v=VERSION";
import { bindStopwatchDoubleTapLap } from "./stopwatch-gestures.js?v=VERSION";
import { initSplitResizer } from "./split-resizer.js?v=VERSION";

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
  let disposed = false;

  const pushUnbinder = (fn) => {
    if (typeof fn === "function") {
      unbinders.push(fn);
    }
  };

  pushUnbinder(
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

  pushUnbinder(bindKeyboardShortcuts({ navigation, modalManager, sw, tm, tb }));

  pushUnbinder(bindBottomNav({ navigation, modalManager, sm }));

  const appEl = $("app");
  pushUnbinder(
    bindNavSwipe({
      appContainer: appEl,
      bottomNav: appEl ? appEl.querySelector("nav") : null,
      navigation,
      modalManager,
    }),
  );

  pushUnbinder(bindStopwatchDoubleTapLap({ $, sw }));
  pushUnbinder(initSplitResizer());

  return () => {
    if (disposed) return;
    disposed = true;

    for (let i = unbinders.length - 1; i >= 0; i -= 1) {
      const fn = unbinders[i];
      try {
        fn?.();
      } catch (err) {
        console.error("[ui-interactions.dispose]", err);
      }
    }

    unbinders.length = 0;
  };
}
