// Файл: www/js/tabata/tabata-background-sync.js

import { getRemainingMs } from "../core/timers-runtime.js?v=VERSION";

export function setupTabataBackgroundSync(
  tb,
  { APP_EVENTS, updateTitle, bgWorker },
) {
  const worker = bgWorker || {
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  tb._phaseTransitionLock = false;

  const advancePhaseSafely = (missed = 0) => {
    if (tb._phaseTransitionLock) return;
    if (tb.status === "STOPPED" || tb.paused || tb.completionHandled) return;

    tb._phaseTransitionLock = true;
    try {
      tb.nextPhase(missed);
    } finally {
      tb._phaseTransitionLock = false;
    }
  };

  tb.tick = (isBackground = false) => {
    if (tb.status === "STOPPED" || tb.paused || tb.completionHandled) return;
    if (tb.phaseClosing || tb._phaseTransitionLock) return;

    const rem = getRemainingMs(tb.phaseEndTime);

    if (rem <= 0) {
      const missed = Math.abs(rem);

      if (document.hidden || missed > 2000) {
        advancePhaseSafely(missed);
        return;
      }

      tb.phaseClosing = true;

      if (!isBackground) tb.render(0);
      tb.ringCtrl?.setTarget(0);

      const closeToken = Date.now();
      tb._phaseCloseToken = closeToken;

      tb.phaseCloseTimer = setTimeout(() => {
        if (tb._phaseCloseToken !== closeToken) return;

        tb.phaseClosing = false;
        tb.phaseCloseTimer = null;

        if (tb.status !== "STOPPED" && !tb.paused && !tb.completionHandled) {
          advancePhaseSafely(0);
        }
      }, 120);

      return;
    }

    const now = performance.now();
    if (now - tb.lastRender >= 16 || isBackground) {
      if (!isBackground) {
        tb.render(rem);
      } else {
        updateTitle(`${tb.status}: ${tb.formatTime(rem)}`);
      }
      tb.lastRender = now;
    }

    if (!isBackground) {
      if (tb.rAF) cancelAnimationFrame(tb.rAF);
      tb.rAF = requestAnimationFrame(() => tb.tick());
    }
  };

  tb.bindCoreEvents = () => {
    tb._unbindBackgroundSync?.();

    const disposers = [];

    const onStartClick = () => tb.toggle();
    tb.els.startBtn?.addEventListener("click", onStartClick);
    disposers.push(() =>
      tb.els.startBtn?.removeEventListener("click", onStartClick),
    );

    const onStopClick = () => tb.stop();
    tb.els.stopBtn?.addEventListener("click", onStopClick);
    disposers.push(() =>
      tb.els.stopBtn?.removeEventListener("click", onStopClick),
    );

    const onTimerStarted = (e) => {
      if (e.detail !== "tabata" && tb.status !== "STOPPED" && !tb.paused) {
        tb.pause();
      }
    };
    document.addEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted);
    disposers.push(() =>
      document.removeEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted),
    );

    const onWorkerMessage = (e) => {
      if (
        e.data?.type === "heartbeat" &&
        tb.status !== "STOPPED" &&
        !tb.paused &&
        !tb.completionHandled &&
        document.hidden
      ) {
        tb.tick(true);
      }
    };
    worker.addEventListener("message", onWorkerMessage);
    disposers.push(() =>
      worker.removeEventListener("message", onWorkerMessage),
    );

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      if (tb.status === "STOPPED") {
        if (tb.phaseCloseTimer) {
          clearTimeout(tb.phaseCloseTimer);
          tb.phaseCloseTimer = null;
        }
        tb.phaseClosing = false;
        tb._phaseTransitionLock = false;
        tb.ringCtrl?.snap(tb.ringLength);
        return;
      }

      if (!tb.paused && !tb.completionHandled) {
        const rem = getRemainingMs(tb.phaseEndTime);

        if (rem <= 0) {
          advancePhaseSafely(Math.abs(rem));
          return;
        }

        tb.lastRender = 0;
        tb.phaseClosing = false;
        tb._phaseTransitionLock = false;

        if (tb.phaseCloseTimer) {
          clearTimeout(tb.phaseCloseTimer);
          tb.phaseCloseTimer = null;
        }

        tb.render(rem);
        tb.tick();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    disposers.push(() =>
      document.removeEventListener("visibilitychange", onVisibilityChange),
    );

    tb._unbindBackgroundSync = () => {
      disposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[tabata-background-sync.dispose]", err);
        }
      });
    };
  };
}
