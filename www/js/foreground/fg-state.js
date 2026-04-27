// Файл: www/js/foreground/fg-state.js

export function getForegroundState({ sw, tm, tb, activeView }) {
  const canResumeStopwatch = !sw.isRunning && sw.elapsedTime > 0;
  const canResumeTimer = tm.isPaused && tm.getRemainingTime() > 0;
  const canResumeTabata = tb.status !== "STOPPED" && tb.paused;

  const isModeAvailable = (mode) => {
    if (mode === "stopwatch") return sw.isRunning || canResumeStopwatch;
    if (mode === "timer") return tm.isRunning || canResumeTimer;
    if (mode === "tabata") {
      return (tb.status !== "STOPPED" && !tb.paused) || canResumeTabata;
    }
    return false;
  };

  if (sw.isRunning) return { mode: "stopwatch", running: true };
  if (tm.isRunning) return { mode: "timer", running: true };
  if (tb.status !== "STOPPED" && !tb.paused)
    return { mode: "tabata", running: true };

  if (isModeAvailable(activeView)) {
    return { mode: activeView, running: false };
  }

  if (canResumeStopwatch) return { mode: "stopwatch", running: false };
  if (canResumeTimer) return { mode: "timer", running: false };
  if (canResumeTabata) return { mode: "tabata", running: false };

  return null;
}

export function buildForegroundPayload({
  state,
  sw,
  tm,
  tb,
  showMs,
  t,
  $,
  formatTime,
}) {
  const buttonIcon = state.running ? "■" : "▶";

  if (state.mode === "stopwatch") {
    return {
      title: t("stopwatch"),
      body: formatTime(sw.elapsedTime, {
        showMs,
        forceHours: sw.elapsedTime >= 3600000,
      }),
      buttonTitle: buttonIcon,
    };
  }

  if (state.mode === "timer") {
    const rem = tm.getRemainingTime();
    return {
      title: t("timer"),
      body: formatTime(rem, {
        showMs: false,
        forceHours: rem >= 3600000,
      }),
      buttonTitle: buttonIcon,
    };
  }

  const remTb = state.running
    ? Math.max(0, tb.phaseEndTime - performance.now())
    : Math.max(0, tb.remainingAtPause || 0);

  const phaseText = state.running
    ? tb.status === "WORK"
      ? t("work")
      : tb.status === "REST"
        ? t("rest")
        : t("get_ready")
    : t("pause");

  return {
    title: $("tb-activeName")?.textContent || t("tabata"),
    body: `${t("round")} ${tb.currentRound}/${tb.rounds} • ${phaseText}: ${formatTime(remTb, { showMs })}`,
    buttonTitle: buttonIcon,
  };
}
