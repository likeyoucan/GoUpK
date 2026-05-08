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

    // Important: stop immediately (no requestAnimationFrame),
    // otherwise in background the completion branch may repeat.
    tb.stop({ resetRing: false, silent: true });
    showToast(t("tabata_complete"));
  };

  tb.advancePhase = () => {
    if (tb.status === "READY") {
      tb.status = "WORK";
      tb.phaseDuration = tb.work;
      tb.phaseStamp += 1;
      sm.play("work_start");
    } else if (tb.status === "WORK") {
      if (tb.currentRound >= tb.rounds) {
        return "complete";
      }
      tb.status = "REST";
      tb.phaseDuration = tb.rest;
      tb.phaseStamp += 1;
      sm.play("rest_start");
    } else if (tb.status === "REST") {
      tb.currentRound += 1;
      tb.status = "WORK";
      tb.phaseDuration = tb.work;
      tb.phaseStamp += 1;
      sm.play("work_start");
    }

    return "ok";
  };

  // Fast-forward phases when app wakes after long background pause.
  tb.applyMissedTime = (missedTime) => {
    let remainingMissed = missedTime;

    while (remainingMissed > 0 && tb.status !== "STOPPED") {
      const currentPhaseDuration =
        tb.status === "READY"
          ? tb.phaseDuration
          : tb.status === "WORK"
            ? tb.work
            : tb.rest;

      const step = Math.min(remainingMissed, currentPhaseDuration);
      remainingMissed -= step;

      const leftInPhase = currentPhaseDuration - step;
      if (leftInPhase <= 0) {
        const result = tb.advancePhase();
        if (result === "complete") {
          return "complete";
        }
        if (remainingMissed === 0) {
          tb.phaseDuration = tb.phaseDuration + leftInPhase;
        }
      } else {
        tb.phaseDuration = leftInPhase;
      }
    }

    return "ok";
  };

  tb.nextPhase = (missedTime = 0) => {
    if (tb.status === "STOPPED" || tb.completionHandled) return;

    if (missedTime === 0) sm.vibrate([100, 50, 100], "strong");
    tb.lastBeepSec = 0;

    if (missedTime > 0) {
      const result = tb.applyMissedTime(missedTime);
      if (result === "complete") {
        handleCompletion();
        return;
      }
      tb.phaseEndTime = performance.now() + tb.phaseDuration;
    } else {
      const result = tb.advancePhase();
      if (result === "complete") {
        handleCompletion();
        return;
      }

      tb.phaseEndTime = performance.now() + tb.phaseDuration;
    }

    tb.updatePhaseStyles();
    tb.tick();
  };
}
