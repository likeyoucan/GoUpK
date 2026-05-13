// Файл: www/js/tabata/tabata-render.js

import { updateText, updateTitle, formatTime } from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";

export function setupTabataRender(tb) {
  tb.updatePhaseStyles = () => {
    if (!tb.els.ring) return;

    updateText(tb.els.roundDisplay, tb.currentRound);
    const statusEl = tb.els.status;

    statusEl.classList.remove(
      "primary-vivid-text",
      "secondary-accent-text",
      "app-text-sec",
      "primary-text",
    );
    tb.els.ring.classList.remove(
      "primary-vivid-stroke",
      "secondary-accent-stroke",
      "primary-stroke",
    );

    if (tb.status === "WORK") {
      updateText(statusEl, t("work"));
      statusEl.classList.add("primary-text");
      tb.els.ring.classList.add("primary-stroke");
    } else if (tb.status === "REST") {
      updateText(statusEl, t("rest"));
      statusEl.classList.add("secondary-accent-text");
      tb.els.ring.classList.add("secondary-accent-stroke");
    } else {
      updateText(statusEl, t("get_ready"));
      statusEl.classList.add("primary-text");
      tb.els.ring.classList.add("primary-stroke");
    }
  };

  tb.render = (rem) => {
    const safeRem = Math.max(0, rem);

    const sTotal = Math.ceil(safeRem / 1000);
    if (sTotal <= 3 && sTotal > 0 && tb.lastBeepSec !== sTotal) {
      sm.play("tick");
      tb.lastBeepSec = sTotal;
    }

    const timeStr = formatTime(safeRem);
    updateText(tb.els.timer, timeStr);

    if (document.hidden) updateTitle(`${tb.status}: ${timeStr}`);

    if (!tb.ringCtrl) return;

    const elapsed = Math.max(0, tb.phaseDuration - safeRem);
    const progress =
      tb.phaseDuration > 0
        ? Math.max(0, Math.min(1, elapsed / tb.phaseDuration))
        : 0;

    const targetOffset = tb.ringLength - progress * tb.ringLength;

    // На смене фазы избегаем резких артефактов:
    // snap только если скачок действительно большой.
    if (tb.lastRenderedPhaseStamp !== tb.phaseStamp) {
      tb.lastRenderedPhaseStamp = tb.phaseStamp;
      const visual = tb.ringCtrl.getVisual
        ? tb.ringCtrl.getVisual()
        : tb.ringLength;
      const jump = Math.abs(targetOffset - visual);

      if (jump > tb.ringLength * 0.45) {
        tb.ringCtrl.snap(targetOffset);
      } else {
        tb.ringCtrl.setTarget(targetOffset);
      }
      return;
    }

    // Важно: без принудительного snap(0) -> финиш выглядит равномернее
    tb.ringCtrl.setTarget(targetOffset);
  };
}
