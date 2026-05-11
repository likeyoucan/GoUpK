// Файл: www/js/tabata/tabata-background-sync.js

export function setupTabataBackgroundSync(tb, { APP_EVENTS, updateTitle }) {
  tb.tick = (isBackground = false) => {
    if (tb.status === "STOPPED" || tb.paused || tb.completionHandled) return;
    if (tb.phaseClosing) return;

    const rem = tb.phaseEndTime - Date.now();

    if (rem <= 0) {
      const missed = Math.abs(rem);

      if (document.hidden || missed > 2000) {
        tb.nextPhase(missed);
        return;
      }

      tb.phaseClosing = true;

      if (!isBackground) tb.render(0);
      tb.ringCtrl?.setTarget(0);

      tb.phaseCloseTimer = setTimeout(() => {
        tb.phaseClosing = false;
        tb.phaseCloseTimer = null;

        if (tb.status !== "STOPPED" && !tb.paused && !tb.completionHandled) {
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
    tb.els.startBtn?.addEventListener("click", () => tb.toggle());
    tb.els.stopBtn?.addEventListener("click", () => tb.stop());

    document.addEventListener(APP_EVENTS.TIMER_STARTED, (e) => {
      if (e.detail !== "tabata" && tb.status !== "STOPPED" && !tb.paused) {
        tb.pause();
      }
    });

    tb.bgWorker.addEventListener("message", (e) => {
      if (
        e.data?.type === "heartbeat" &&
        tb.status !== "STOPPED" &&
        !tb.paused &&
        !tb.completionHandled &&
        document.hidden
      ) {
        tb.tick(true);
      }
    });

    document.addEventListener("visibilitychange", () => {
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
        const rem = tb.phaseEndTime - Date.now();

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
    });
  };
}
