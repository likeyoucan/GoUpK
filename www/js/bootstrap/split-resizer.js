// Файл: www/js/bootstrap/split-resizer.js

import {
  VIEW_IDS,
  SPLIT_BEHAVIOR,
} from "./split-resizer/constants.js?v=VERSION";
import {
  isRowLayout,
  getForcedTargetForViewport,
} from "./split-resizer/viewport.js?v=VERSION";
import {
  applySnapToAll,
  getTargetFromGlobalSnap,
} from "./split-resizer/apply.js?v=VERSION";
import { setupOneView } from "./split-resizer/view-controller.js?v=VERSION";

const ctx = {
  views: [],
  detachViewportListeners: null,
  globalSnap: "middle",
  behavior: SPLIT_BEHAVIOR,
};

export function initSplitResizer() {
  ctx.detachViewportListeners?.();
  ctx.detachViewportListeners = null;

  ctx.views = VIEW_IDS.map((id) => {
    const viewEl = document.getElementById(id);
    if (!viewEl) return null;

    return {
      viewEl,
      handler: viewEl.querySelector(".resizer_handler"),
      topHalf: viewEl.querySelector(".view-top-half"),
    };
  }).filter(Boolean);

  const viewDisposers = ctx.views
    .map((v) => setupOneView(ctx, v))
    .filter(Boolean);

  applySnapToAll(ctx, getTargetFromGlobalSnap(ctx), { animate: false });

  const onViewportResize = () => {
    const forced = getForcedTargetForViewport();

    if (forced != null) {
      ctx.globalSnap = forced === 0 ? "top" : "middle";
      applySnapToAll(ctx, forced, { animate: false });
      return;
    }

    const anyRow = ctx.views.some((v) => v?.viewEl && isRowLayout(v.viewEl));
    if (anyRow && ctx.globalSnap === "bottom") {
      ctx.globalSnap = "middle";
    }

    applySnapToAll(ctx, getTargetFromGlobalSnap(ctx), { animate: false });
  };

  window.addEventListener("resize", onViewportResize);
  window.addEventListener("orientationchange", onViewportResize);

  ctx.detachViewportListeners = () => {
    window.removeEventListener("resize", onViewportResize);
    window.removeEventListener("orientationchange", onViewportResize);

    viewDisposers.forEach((off) => {
      try {
        off?.();
      } catch (err) {
        console.error("[split-resizer.dispose]", err);
      }
    });
  };

  return ctx.detachViewportListeners;
}
