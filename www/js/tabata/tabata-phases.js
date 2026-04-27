// Файл: www/js/tabata/tabata-phases.js

import { showToast, announceToScreenReader } from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";

export function setupTabataPhases(tb) {
  tb.advancePhase = () => {
    if (tb.status === "READY") {
      tb.status = "WORK";
      tb.phaseDuration = tb.work;
      sm.play("work_start");
    } else if (tb.status === "WORK") {
      if (tb.currentRound >= tb.rounds) {
        return "complete";
      }
      tb.status = "REST";
      tb.phaseDuration = tb.rest;
      sm.play("rest_start");
    } else if (tb.status === "REST") {
      tb.currentRound += 1;
      tb.status = "WORK";
      tb.phaseDuration = tb.work;
      sm.play("work_start");
    }

    return "ok";
  };

  tb.applyMissedTime = (missedTime) => {
    let remainingMissed = missedTime;

    while (remainingMissed > 0 && tb.status !== "STOPPED") {
      const currentPhaseDuration =
        tb.status === "READY" ? tb.phaseDuration : tb.status === "WORK" ? tb.work : tb.rest;

      const step = Math.min(remainingMissed, currentPhaseDuration);
      remainingMissed -= step;

      const leftInPhase = currentPhaseDuration - step;
      if (leftInPhase <= 0) {
        const result = tb.advancePhase();
        if (result === "complete") {
          tb.stop();
          return false;
        }
        if (remainingMissed === 0) {
          tb.phaseDuration = tb.phaseDuration + leftInPhase;
        }
      } else {
        tb.phaseDuration = leftInPhase;
      }
    }

    return true;
  };

  tb.nextPhase = (missedTime = 0) => {
    if (missedTime === 0) sm.vibrate([100, 50, 100], "strong");
    tb.lastBeepSec = 0;

    if (missedTime > 0) {
      const shouldContinue = tb.applyMissedTime(missedTime);
      if (!shouldContinue) return;
      tb.phaseEndTime = performance.now() + tb.phaseDuration;
    } else {
      const result = tb.advancePhase();
      if (result === "complete") {
        sm.vibrate([200, 100, 200, 100, 400]);
        sm.play("complete");
        announceToScreenReader(t("tabata_complete"));

        requestAnimationFrame(() => {
          showToast(t("tabata_complete"));
          tb.stop();
        });

        return;
      }

      tb.phaseEndTime = performance.now() + tb.phaseDuration;
    }

    tb.updatePhaseStyles();
    tb.tick();
  };
}