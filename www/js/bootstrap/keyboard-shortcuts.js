// Файл: www/js/bootstrap/keyboard-shortcuts.js

function isInteractiveElement(target) {
  if (!(target instanceof HTMLElement)) return false;

  if (
    target.closest('input, textarea, select, button, [contenteditable="true"]')
  ) {
    return true;
  }

  if (
    target.closest(
      '[role="button"], [role="option"], [role="listbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="switch"]',
    )
  ) {
    return true;
  }

  if (
    target.closest(
      '[tabindex="0"][data-interactive], .custom-select-trigger, .custom-select-option',
    )
  ) {
    return true;
  }

  return false;
}

function keyLower(e) {
  return String(e.key || "").toLowerCase();
}

function isSpaceKey(e) {
  return e.code === "Space" || e.key === " ";
}

export function bindKeyboardShortcuts({
  navigation,
  modalManager,
  sw,
  tm,
  tb,
}) {
  const onKeydown = (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;

    if (e.defaultPrevented) return;
    if (e.repeat) return;
    if (modalManager.hasActiveModal()) return;
    if (isInteractiveElement(target)) return;

    const view = navigation.activeView;
    const k = keyLower(e);

    if (isSpaceKey(e)) {
      e.preventDefault();

      if (view === "stopwatch") {
        sw.toggle();
      } else if (view === "timer") {
        void tm.toggle();
      } else if (view === "tabata") {
        tb.toggle();
      }

      return;
    }

    if (k === "l" && view === "stopwatch") {
      e.preventDefault();
      sw.recordLapOrReset();
      return;
    }

    if (k === "r") {
      e.preventDefault();

      if (view === "timer") {
        void tm.reset(true);
      } else if (view === "tabata") {
        tb.stop();
      }
    }
  };

  document.addEventListener("keydown", onKeydown);

  return () => {
    document.removeEventListener("keydown", onKeydown);
  };
}
