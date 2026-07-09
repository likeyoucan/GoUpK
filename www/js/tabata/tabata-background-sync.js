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

  const canTick = () =>
    tb.status !== "STOPPED" &&
    !tb.paused &&
    !tb.completionHandled &&
    !tb.phaseClosing;

  tb.tick = (isBackground = false) => {
    if (!canTick()) return;

    const rem = getRemainingMs(tb.phaseEndTime);

    if (rem <= 0) {
      const missed = Math.abs(rem);

      if (document.hidden || missed > 2000) {
        tb.nextPhase(missed);
        return;
      }

      tb.phaseClosing = true;

      if (!isBackground) tb.render(0);
      tb.ringCtrl?.setTarget(0);

      if (tb.phaseCloseTimer) {
        clearTimeout(tb.phaseCloseTimer);
        tb.phaseCloseTimer = null;
      }

      tb.phaseCloseTimer = setTimeout(() => {
        tb.phaseClosing = false;
        tb.phaseCloseTimer = null;

        if (canTick()) {
          tb.nextPhase(0);
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

    const bind = (el, event, handler, options) => {
      if (!el) return;
      el.addEventListener(event, handler, options);
      disposers.push(() => el.removeEventListener(event, handler, options));
    };

    bind(tb.els.startBtn, "click", () => tb.toggle());
    bind(tb.els.stopBtn, "click", () => tb.stop());

    const onTimerStarted = (e) => {
      if (e.detail !== "tabata" && tb.status !== "STOPPED" && !tb.paused) {
        tb.pause();
      }
    };
    bind(document, APP_EVENTS.TIMER_STARTED, onTimerStarted);

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
        tb.ringCtrl?.snap(tb.ringLength);
        return;
      }

      if (!tb.paused && !tb.completionHandled) {
        const rem = getRemainingMs(tb.phaseEndTime);

        if (rem <= 0) {
          tb.nextPhase(Math.abs(rem));
          return;
        }

        tb.lastRender = 0;
        tb.phaseClosing = false;

        if (tb.phaseCloseTimer) {
          clearTimeout(tb.phaseCloseTimer);
          tb.phaseCloseTimer = null;
        }

        tb.render(rem);
        tb.tick();
      }
    };
    bind(document, "visibilitychange", onVisibilityChange);

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
