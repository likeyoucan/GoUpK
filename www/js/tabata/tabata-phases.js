// Файл: www/js/tabata/tabata-phases.js

import { showToast, announceToScreenReader } from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";

export function setupTabataPhases(tb) {
  const handleCompletion = () => {
    if (tb.completionHandled) return;
    tb.completionHandled = true;

    sm.vibrate([200, 100, 200, 100, 400]);
    sm.play("complete");
    announceToScreenReader(t("tabata_complete"));

    tb.stop({ resetRing: true, silent: true });
    showToast(t("tabata_complete"));
  };

  tb.advancePhase = () => {
    if (tb.status === "READY") {
      tb.status = "WORK";
      tb.phaseDuration = tb.work;
      tb.phaseStamp += 1;
      sm.play("work_start");
      return "ok";
    }

    if (tb.status === "WORK") {
      if (tb.currentRound >= tb.rounds) {
        return "complete";
      }
      tb.status = "REST";
      tb.phaseDuration = tb.rest;
      tb.phaseStamp += 1;
      sm.play("rest_start");
      return "ok";
    }

    // REST -> next WORK
    tb.currentRound += 1;
    tb.status = "WORK";
    tb.phaseDuration = tb.work;
    tb.phaseStamp += 1;
    sm.play("work_start");
    return "ok";
  };

  // Fully Date.now-driven fast-forward logic.
  tb.nextPhase = (missedTime = 0) => {
    if (tb.status === "STOPPED" || tb.completionHandled) return;

    if (missedTime === 0) sm.vibrate([100, 50, 100], "strong");
    tb.lastBeepSec = 0;

    let overshoot = Math.max(0, missedTime);

    const enterNextPhase = () => {
      const result = tb.advancePhase();
      if (result === "complete") {
        handleCompletion();
        return false;
      }
      return true;
    };

    // Current phase has ended -> move to next phase at least once.
    if (!enterNextPhase()) return;

    // Consume additional overshoot across multiple phases.
    while (overshoot > 0 && tb.status !== "STOPPED" && !tb.completionHandled) {
      if (overshoot >= tb.phaseDuration) {
        overshoot -= tb.phaseDuration;
        if (!enterNextPhase()) return;
      } else {
        tb.phaseDuration -= overshoot;
        overshoot = 0;
      }
    }

    tb.phaseEndTime = Date.now() + tb.phaseDuration;
    tb.updatePhaseStyles();
    tb.tick();
  };
}
