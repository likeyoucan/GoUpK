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
    ) ||
    target.closest(
      '[tabindex="0"][data-interactive], .custom-select-trigger, .custom-select-option',
    )
  ) {
    return true;
  }

  return false;
}

export function bindKeyboardShortcuts({ navigation, modalManager, sw, tm, tb }) {
  const onKeydown = (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;

    if (modalManager.hasActiveModal() || isInteractiveElement(target)) return;

    const view = navigation.activeView;

    if (e.code === "Space") {
      e.preventDefault();
      if (view === "stopwatch") sw.toggle();
      else if (view === "timer") tm.toggle();
      else if (view === "tabata") tb.toggle();
    } else if (e.key.toLowerCase() === "l" && view === "stopwatch") {
      sw.recordLapOrReset();
    } else if (e.key.toLowerCase() === "r") {
      if (view === "timer") tm.reset(true);
      else if (view === "tabata") tb.stop();
    }
  };

  document.addEventListener("keydown", onKeydown);
  return () => document.removeEventListener("keydown", onKeydown);
}