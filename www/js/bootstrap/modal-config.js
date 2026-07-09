// Файл: www/js/bootstrap/modal-config.js

export function createModalConfig({ sw, tb }) {
  return [
    {
      id: "sw-sessions-modal",
      type: "bottom-sheet",
      handlerId: "sw-modal-handler",
      onOpen: () => {
        const run = () => sw.sortSessions(sw.currentSort);

        // Heavier delay for first interaction window to avoid animation hitch.
        setTimeout(() => {
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(run, { timeout: 700 });
          } else {
            setTimeout(run, 0);
          }
        }, 520);
      },
    },
    {
      id: "tb-modal",
      type: "bottom-sheet",
      handlerId: "tb-modal-handler",
      onOpen: (data) => {
        // Give animation the first frame budget.
        setTimeout(() => tb.prepareEdit(data.idToEdit), 180);
      },
      onClose: () => {
        tb.editingWorkoutId = null;
      },
    },
    { id: "reset-modal", type: "alert", contentId: "reset-modal-content" },
    {
      id: "sw-clear-modal",
      type: "alert",
      contentId: "sw-clear-modal-content",
    },
    {
      id: "sw-name-modal",
      type: "alert",
      contentId: "sw-name-modal-content",
      onOpen: (data) => sw.prepareNameForm(data),
    },
    {
      id: "sw-share-mode-modal",
      type: "alert",
      contentId: "sw-share-mode-content",
      onClose: () => {
        sw.pendingShareSession = null;
      },
    },
    {
      id: "pro-subscribe-modal",
      type: "alert",
      contentId: "pro-subscribe-modal-content",
    },
    {
      id: "legal-modal",
      type: "alert",
      contentId: "legal-modal-content",
    },
  ];
}
