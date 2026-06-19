// Файл: www/js/core/phase-close.js

export function clearPhaseClose(controller) {
  if (!controller?.phaseCloseTimer) return;
  clearTimeout(controller.phaseCloseTimer);
  controller.phaseCloseTimer = null;
}

export function schedulePhaseClose(controller, onClose, delayMs = 120) {
  clearPhaseClose(controller);

  controller.phaseCloseTimer = setTimeout(() => {
    controller.phaseCloseTimer = null;
    onClose?.();
  }, delayMs);
}
