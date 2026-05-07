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
    const sTotal = Math.ceil(rem / 1000);
    if (sTotal <= 3 && sTotal > 0 && tb.lastBeepSec !== sTotal) {
      sm.play("tick");
      tb.lastBeepSec = sTotal;
    }

    const timeStr = formatTime(rem);
    updateText(tb.els.timer, timeStr);

    // Avoid title churn each frame on active screen
    if (document.hidden) updateTitle(`${tb.status}: ${timeStr}`);

    if (tb.els.ring) {
      const elapsed = Math.max(0, tb.phaseDuration - rem);
      const progress =
        tb.phaseDuration > 0
          ? Math.max(0, Math.min(1, elapsed / tb.phaseDuration))
          : 0;

      const targetOffset = tb.ringLength - progress * tb.ringLength;

      if (!Number.isFinite(tb.ringVisualOffset)) {
        tb.ringVisualOffset = targetOffset;
      }

      // Slightly faster than timer for crisper phase transitions
      const alpha = 0.26;
      tb.ringVisualOffset += (targetOffset - tb.ringVisualOffset) * alpha;

      if (Math.abs(targetOffset - tb.ringVisualOffset) < 0.25) {
        tb.ringVisualOffset = targetOffset;
      }

      tb.els.ring.style.strokeDashoffset = tb.ringVisualOffset;
    }
  };
}
