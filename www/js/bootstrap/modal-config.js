// Файл: www/js/bootstrap/modal-config.js

export function createModalConfig({ sw, tb }) {
  return [
    {
      id: "sw-sessions-modal",
      type: "bottom-sheet",
      handlerId: "sw-modal-handler",
    },
    {
      id: "tb-modal",
      type: "bottom-sheet",
      handlerId: "tb-modal-handler",
      onOpen: (data) => {
        const idToEdit = data?.idToEdit ?? null;

        // 1) Быстрая легкая часть (не блокирует анимацию)
        requestAnimationFrame(() => {
          const titleEl = document.getElementById("tb-modal-title");
          if (titleEl) {
            titleEl.textContent = idToEdit ? "Edit" : "Create Workout";
          }
        });

        // 2) Тяжелая часть строго после окончания transition и в idle
        const runHeavy = () => tb.prepareEdit(idToEdit);

        setTimeout(() => {
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(runHeavy, { timeout: 1200 });
          } else {
            setTimeout(runHeavy, 0);
          }
        }, 520);
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
