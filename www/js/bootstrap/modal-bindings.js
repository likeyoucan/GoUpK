// Файл: www/js/bootstrap/modal-bindings.js

export function bindModalActions({
  $,
  showToast,
  t,
  modalManager,
  themeManager,
  sm,
  langManager,
  sw,
  tb,
}) {
  const confirmReset = () => {
    modalManager.closeCurrent();
    themeManager.resetSettings();
    sm.resetSettings();
    langManager.resetSettings();
    setTimeout(() => showToast(t("settings_reset_success")), 450);
  };

  const handlers = [];

  const bind = (id, event, fn) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener(event, fn);
    handlers.push({ el, event, fn });
  };

  bind("sw-openResultsBtn", "click", () => {
    modalManager.open("sw-sessions-modal");
  });

  bind("tb-openModalBtn", "click", () => {
    modalManager.open("tb-modal", { idToEdit: null });
  });

  bind("btn-open-reset", "click", () => {
    modalManager.open("reset-modal");
  });

  bind("sw-clearAllBtn", "click", () => {
    if (sw.savedSessions.length > 0) modalManager.open("sw-clear-modal");
  });

  bind("reset-confirm", "click", confirmReset);
  bind("sw-clear-confirm", "click", () => sw.confirmClearAll());

  bind("sw-name-modal-content", "submit", (e) => {
    e.preventDefault();
    sw.confirmNameModal();
  });

  bind("tb-modal-form", "submit", (e) => {
    e.preventDefault();
    tb.saveWorkout();
  });

  return () => {
    handlers.forEach(({ el, event, fn }) => {
      el.removeEventListener(event, fn);
    });
  };
}