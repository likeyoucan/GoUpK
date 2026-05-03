// Файл: www/js/foreground/fg-state.js

export function getForegroundState({ sw, tm, tb, activeView }) {
  const canResumeStopwatch = !sw.isRunning && sw.elapsedTime > 0;
  const canResumeTimer = tm.isPaused && tm.getRemainingTime() > 0;
  const canResumeTabata = tb.status !== "STOPPED" && tb.paused;

  const tabataMeta = () =>
    `${tb.selectedId || "na"}|${tb.currentRound || 0}|${tb.rounds || 0}|${tb.status || "STOPPED"}`;

  const makeState = (mode, running) =>
    mode === "tabata"
      ? { mode, running, metaKey: tabataMeta() }
      : { mode, running, metaKey: "" };

  const isModeAvailable = (mode) => {
    if (mode === "stopwatch") return sw.isRunning || canResumeStopwatch;
    if (mode === "timer") return tm.isRunning || canResumeTimer;
    if (mode === "tabata") {
      return (tb.status !== "STOPPED" && !tb.paused) || canResumeTabata;
    }
    return false;
  };

  if (sw.isRunning) return makeState("stopwatch", true);
  if (tm.isRunning) return makeState("timer", true);
  if (tb.status !== "STOPPED" && !tb.paused) return makeState("tabata", true);

  if (isModeAvailable(activeView)) return makeState(activeView, false);
  if (canResumeStopwatch) return makeState("stopwatch", false);
  if (canResumeTimer) return makeState("timer", false);
  if (canResumeTabata) return makeState("tabata", false);

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
  const buttonTitle = state.running ? t("stop") : t("play");

  if (state.mode === "stopwatch") {
    return {
      title: t("stopwatch"),
      body: formatTime(sw.elapsedTime, {
        showMs,
        forceHours: sw.elapsedTime >= 3600000,
      }),
      buttonTitle,
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
      buttonTitle,
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

  const workoutName =
    $("tb-runningWorkoutName")?.textContent?.trim() ||
    $("tb-activeName")?.textContent?.trim() ||
    t("tabata");

  return {
    title: `${t("tabata")} - ${workoutName}`,
    body: `${t("round")} ${tb.currentRound}/${tb.rounds} • ${phaseText}: ${formatTime(remTb, { showMs })}`,
    buttonTitle,
  };
}
