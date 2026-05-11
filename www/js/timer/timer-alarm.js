// Файл: www/js/timer/timer-alarm.js

const DEFAULT_REQUEST_CODE = 1001;

function getBridge() {
  return window.Capacitor?.Plugins?.TimerAlarmBridge || null;
}

export function createTimerAlarmScheduler({ requestCode = DEFAULT_REQUEST_CODE } = {}) {
  return {
    async schedule(epochMs) {
      const bridge = getBridge();
      if (!bridge?.scheduleExact) {
        return { scheduled: false, reason: "bridge_missing" };
      }

      try {
        const res = await bridge.scheduleExact({ epochMs, requestCode });
        if (
          res &&
          res.scheduled === false &&
          res.reason === "cannot_schedule_exact_alarm"
        ) {
          return res;
        }
        return res || { scheduled: true };
      } catch (e) {
        console.warn("[timer-alarm] schedule failed", e);
        return { scheduled: false, reason: "schedule_failed" };
      }
    },

    async cancel() {
      const bridge = getBridge();
      if (!bridge?.cancel) return { canceled: false, reason: "bridge_missing" };

      try {
        const res = await bridge.cancel({ requestCode });
        return res || { canceled: true };
      } catch (e) {
        console.warn("[timer-alarm] cancel failed", e);
        return { canceled: false, reason: "cancel_failed" };
      }
    },
  };
}