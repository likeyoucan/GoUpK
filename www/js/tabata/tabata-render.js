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
    updateTitle(`${tb.status}: ${timeStr}`);

    const appEl = document.getElementById("app");
    if (tb.els.ring && !appEl?.classList.contains("is-view-transitioning")) {
      tb.els.ring.style.strokeDashoffset =
        tb.ringLength -
        (Math.max(0, tb.phaseDuration - rem) / tb.phaseDuration) * tb.ringLength;
    }
  };
}