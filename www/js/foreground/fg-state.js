export function getForegroundState({ sw, tm, tb, activeView }) {
  const canResumeStopwatch = !sw.isRunning && sw.elapsedTime > 0;
  const canResumeTimer = tm.isPaused && tm.getRemainingTime() > 0;
  const canResumeTabata = tb.status !== "STOPPED" && tb.paused;

  const tabataMeta = () =>
    `${tb.selectedId || "na"}|${tb.currentRound || 0}|${tb.rounds || 0}|${tb.status || "STOPPED"}|${Math.floor(
      (tb.status !== "STOPPED"
        ? Math.max(
            0,
            (tb.paused ? tb.remainingAtPause : tb.phaseEndTime - Date.now()) ||
              0,
          )
        : 0) / 1000,
    )}`;

  const timerMeta = () =>
    `${tm.initialDurationMs || tm.totalDuration || 0}|${Math.floor(
      (tm.getRemainingTime() || 0) / 1000,
    )}|${tm.isPaused ? "p" : "r"}`;

  const makeState = (mode, running) => {
    if (mode === "tabata") return { mode, running, metaKey: tabataMeta() };
    if (mode === "timer") return { mode, running, metaKey: timerMeta() };
    return { mode, running, metaKey: "" };
  };

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
  const remainingLabel =
    t("remaining") === "remaining" ? "Remaining" : t("remaining");

  if (state.mode === "stopwatch") {
    // Секундомер: можно оставлять showMs по настройке
    return {
      title: t("stopwatch"),
      body: formatTime(sw.elapsedTime, {
        showMs,
        forceHours: sw.elapsedTime >= 3600000,
      }),
    };
  }

  if (state.mode === "timer") {
    const rem = tm.getRemainingTime();
    const total = tm.initialDurationMs || tm.totalDuration || 0;

    // Таймер: без миллисекунд в уведомлении
    return {
      title:
        total > 0
          ? `${t("timer")} ${formatTime(total, {
              showMs: false,
              forceHours: total >= 3600000,
            })}`
          : t("timer"),
      body: state.running
        ? `${remainingLabel}: ${formatTime(rem, {
            showMs: false,
            forceHours: rem >= 3600000,
          })}`
        : `${t("pause")} • ${remainingLabel}: ${formatTime(rem, {
            showMs: false,
            forceHours: rem >= 3600000,
          })}`,
    };
  }

  const remTb = state.running
    ? Math.max(0, tb.phaseEndTime - Date.now())
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

  // Табата: без миллисекунд в уведомлении
  return {
    title: `${t("tabata")} - ${workoutName}`,
    body: `${t("round")} ${tb.currentRound}/${tb.rounds} • ${phaseText} • ${formatTime(remTb, { showMs: false })}`,
  };
}
