// Файл: www/js/tabata/tabata-phases.js

import { showToast, announceToScreenReader } from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { emitAppEvent } from "../events/app-events.js?v=VERSION";
import { applyTabataEngineSnapshot } from "../core/engine-adapters.js?v=VERSION";

export function setupTabataPhases(tb) {
  function playPhaseStartSound() {
    if (tb.status === "WORK") sm.play("work_start");
    else if (tb.status === "REST") sm.play("rest_start");
  }

  const handleCompletion = () => {
    if (tb.completionHandled) return;
    tb.completionHandled = true;

    sm.vibrate([200, 100, 200, 100, 400]);
    sm.play("complete");
    announceToScreenReader(t("tabata_complete"));

    tb.stop({ resetRing: true, silent: true });
    showToast(t("tabata_complete"));

    emitAppEvent(APP_EVENTS.TABATA_COMPLETED, {
      at: Date.now(),
      rounds: tb.rounds,
      workoutId: tb.selectedId || null,
    });
  };

  tb.advancePhase = () => {
    const step = tb.tabataEngine.advanceOnce();

    if (step.completed) return "complete";

    applyTabataEngineSnapshot(tb, step.snapshot);
    tb.phaseStamp += 1;
    playPhaseStartSound();
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
      const currentPhaseDuration = tb.tabataEngine.getPhaseDuration();

      if (overshoot >= currentPhaseDuration) {
        overshoot -= currentPhaseDuration;
        if (!enterNextPhase()) return;
      } else {
        applyTabataEngineSnapshot(
          tb,
          tb.tabataEngine.shortenCurrentPhase(overshoot),
        );
        overshoot = 0;
      }
    }

    tb.updatePhaseStyles();
    tb.tick();
  };
}
