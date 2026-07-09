// Файл: www/js/bootstrap/modal-config.js

export function createModalConfig({ sw, tb }) {
  return [
    {
      id: "sw-sessions-modal",
      type: "bottom-sheet",
      handlerId: "sw-modal-handler",
      onOpen: () => {
        const run = () => sw.sortSessions(sw.currentSort);

        // Let sheet animation start first, then do heavy list work.
        setTimeout(() => {
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(run, { timeout: 500 });
          } else {
            setTimeout(run, 0);
          }
        }, 160);
      },
    },
    {
      id: "tb-modal",
      type: "bottom-sheet",
      handlerId: "tb-modal-handler",
      onOpen: (data) => {
        // Small defer to reduce first-open startup contention.
        setTimeout(() => tb.prepareEdit(data.idToEdit), 80);
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
