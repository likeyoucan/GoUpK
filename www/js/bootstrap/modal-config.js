// Файл: www/js/bootstrap/modal-config.js

let tbPrepareRaf = 0;
let tbPrepareIdle = 0;

function cancelTbPrepare() {
  if (tbPrepareRaf) {
    cancelAnimationFrame(tbPrepareRaf);
    tbPrepareRaf = 0;
  }

  if (tbPrepareIdle && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(tbPrepareIdle);
    tbPrepareIdle = 0;
  }
}

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
        cancelTbPrepare();

        const run = () => tb.prepareEdit(data?.idToEdit ?? null);

        tbPrepareRaf = requestAnimationFrame(() => {
          tbPrepareRaf = 0;

          if (typeof window.requestIdleCallback === "function") {
            tbPrepareIdle = window.requestIdleCallback(
              () => {
                tbPrepareIdle = 0;
                run();
              },
              { timeout: 250 },
            );
          } else {
            run();
          }
        });
      },
      onClose: () => {
        cancelTbPrepare();
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
