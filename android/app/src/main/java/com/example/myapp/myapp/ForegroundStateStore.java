package com.example.myapp;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Locale;

public class ForegroundStateStore {
    private static final String PREFS = "fg_runtime_state";

    public static final String MODE_NONE = "none";
    public static final String MODE_STOPWATCH = "stopwatch";
    public static final String MODE_TIMER = "timer";
    public static final String MODE_TABATA = "tabata";

    private final SharedPreferences prefs;

    public ForegroundStateStore(Context context) {
        this.prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static class RuntimeState {
        public String mode = MODE_NONE;
        public boolean running = false;
        public long updatedAt = 0L;

        public long swElapsedMs = 0L;
        public long swStartedAt = 0L;
        public long swBaseElapsedMs = 0L;

        public long tmRemainingMs = 0L;
        public long tmTotalMs = 0L;
        public long tmEndsAt = 0L;

        public String tbStatus = "STOPPED";
        public int tbRound = 1;
        public int tbRounds = 1;
        public String tbWorkoutName = "Tabata";
        public long tbRemainingMs = 0L;
        public long tbPhaseDuration = 0L;
        public long tbEndsAt = 0L;

        // Native phase plan for background Tabata progression
        public long tbWorkMs = 20000L;
        public long tbRestMs = 10000L;
        public long tbReadyMs = 5000L;

        public String notifTitle = "Stopwatch";
        public String notifBody = "00:00";
        public String toggleTitle = "▶";

        public String channelId = AppForegroundService.CHANNEL_ID;
        public boolean isDarkTheme = false;
        public String accentColor = "#3399ff";
        public String onAccentColor = "#ffffff";
    }

    public static class NotificationPayload {
        public String title;
        public String body;
        public String toggleTitle;
        public String channelId;
        public boolean isDarkTheme;
        public String accentColor;
        public String onAccentColor;
    }

    public RuntimeState read() {
        RuntimeState s = new RuntimeState();

        s.mode = prefs.getString("mode", MODE_NONE);
        s.running = prefs.getBoolean("running", false);
        s.updatedAt = prefs.getLong("updatedAt", 0L);

        s.swElapsedMs = prefs.getLong("swElapsedMs", 0L);
        s.swStartedAt = prefs.getLong("swStartedAt", 0L);
        s.swBaseElapsedMs = prefs.getLong("swBaseElapsedMs", 0L);

        s.tmRemainingMs = prefs.getLong("tmRemainingMs", 0L);
        s.tmTotalMs = prefs.getLong("tmTotalMs", 0L);
        s.tmEndsAt = prefs.getLong("tmEndsAt", 0L);

        s.tbStatus = prefs.getString("tbStatus", "STOPPED");
        s.tbRound = prefs.getInt("tbRound", 1);
        s.tbRounds = prefs.getInt("tbRounds", 1);
        s.tbWorkoutName = prefs.getString("tbWorkoutName", "Tabata");
        s.tbRemainingMs = prefs.getLong("tbRemainingMs", 0L);
        s.tbPhaseDuration = prefs.getLong("tbPhaseDuration", 0L);
        s.tbEndsAt = prefs.getLong("tbEndsAt", 0L);

        s.tbWorkMs = prefs.getLong("tbWorkMs", 20000L);
        s.tbRestMs = prefs.getLong("tbRestMs", 10000L);
        s.tbReadyMs = prefs.getLong("tbReadyMs", 5000L);

        s.notifTitle = prefs.getString("notifTitle", "Stopwatch");
        s.notifBody = prefs.getString("notifBody", "00:00");
        s.toggleTitle = prefs.getString("toggleTitle", "▶");

        s.channelId = prefs.getString("channelId", AppForegroundService.CHANNEL_ID);
        s.isDarkTheme = prefs.getBoolean("isDarkTheme", false);
        s.accentColor = prefs.getString("accentColor", "#3399ff");
        s.onAccentColor = prefs.getString("onAccentColor", "#ffffff");

        return s;
    }

    public void write(RuntimeState s) {
        prefs.edit()
            .putString("mode", s.mode)
            .putBoolean("running", s.running)
            .putLong("updatedAt", s.updatedAt)

            .putLong("swElapsedMs", s.swElapsedMs)
            .putLong("swStartedAt", s.swStartedAt)
            .putLong("swBaseElapsedMs", s.swBaseElapsedMs)

            .putLong("tmRemainingMs", s.tmRemainingMs)
            .putLong("tmTotalMs", s.tmTotalMs)
            .putLong("tmEndsAt", s.tmEndsAt)

            .putString("tbStatus", s.tbStatus)
            .putInt("tbRound", s.tbRound)
            .putInt("tbRounds", s.tbRounds)
            .putString("tbWorkoutName", s.tbWorkoutName)
            .putLong("tbRemainingMs", s.tbRemainingMs)
            .putLong("tbPhaseDuration", s.tbPhaseDuration)
            .putLong("tbEndsAt", s.tbEndsAt)

            .putLong("tbWorkMs", s.tbWorkMs)
            .putLong("tbRestMs", s.tbRestMs)
            .putLong("tbReadyMs", s.tbReadyMs)

            .putString("notifTitle", s.notifTitle)
            .putString("notifBody", s.notifBody)
            .putString("toggleTitle", s.toggleTitle)

            .putString("channelId", s.channelId)
            .putBoolean("isDarkTheme", s.isDarkTheme)
            .putString("accentColor", s.accentColor)
            .putString("onAccentColor", s.onAccentColor)
            .apply();
    }

    public void clear() {
        prefs.edit().clear().apply();
    }

    public void updateFromJson(JSONObject runtime) {
        if (runtime == null) return;

        RuntimeState s = read();
        long now = System.currentTimeMillis();

        String prevMode = s.mode;
        boolean prevRunning = s.running;
        String prevTbStatus = s.tbStatus;
        int prevTbRound = s.tbRound;
        int prevTbRounds = s.tbRounds;
        long prevTbPhaseDuration = s.tbPhaseDuration;

        long nativeSwElapsedNow = getStopwatchElapsedNow(s, now);
        long nativeTimerRemainingNow = getTimerRemainingNow(s, now);
        long nativeTabataRemainingNow = getTabataRemainingNow(s, now);

        long incomingUpdatedAt = runtime.optLong("updatedAt", 0L);
        if (incomingUpdatedAt > 0L && incomingUpdatedAt + 180L < s.updatedAt) {
            return;
        }

        s.mode = runtime.optString("mode", s.mode);
        s.running = runtime.has("running") ? runtime.optBoolean("running", s.running) : s.running;
        s.updatedAt = incomingUpdatedAt > 0L ? incomingUpdatedAt : now;

        long incomingSwElapsed = Math.max(0L, runtime.optLong("swElapsedMs", s.swElapsedMs));
        long incomingTimerRemaining = Math.max(0L, runtime.optLong("tmRemainingMs", s.tmRemainingMs));
        long incomingTimerTotal = Math.max(0L, runtime.optLong("tmTotalMs", s.tmTotalMs));
        long incomingTabataRemaining = Math.max(0L, runtime.optLong("tbRemainingMs", s.tbRemainingMs));

        s.tbStatus = runtime.optString("tbStatus", s.tbStatus);
        s.tbRound = Math.max(1, runtime.optInt("tbRound", s.tbRound));
        s.tbRounds = Math.max(1, runtime.optInt("tbRounds", s.tbRounds));
        s.tbWorkoutName = runtime.optString("tbWorkoutName", s.tbWorkoutName);
        s.tbPhaseDuration = Math.max(0L, runtime.optLong("tbPhaseDuration", s.tbPhaseDuration));

        s.tbWorkMs = Math.max(1L, runtime.optLong("tbWorkMs", s.tbWorkMs));
        s.tbRestMs = Math.max(1L, runtime.optLong("tbRestMs", s.tbRestMs));
        s.tbReadyMs = Math.max(1L, runtime.optLong("tbReadyMs", s.tbReadyMs));

        s.notifTitle = runtime.optString("notifTitle", s.notifTitle);
        s.notifBody = runtime.optString("notifBody", s.notifBody);

        s.channelId = runtime.optString("channelId", s.channelId);
        s.isDarkTheme = runtime.has("isDarkTheme") ? runtime.optBoolean("isDarkTheme", s.isDarkTheme) : s.isDarkTheme;
        s.accentColor = runtime.optString("accentColor", s.accentColor);
        s.onAccentColor = runtime.optString("onAccentColor", s.onAccentColor);

        if (MODE_STOPWATCH.equals(s.mode)) {
            if (s.running) {
                if (MODE_STOPWATCH.equals(prevMode) && prevRunning) {
                    long mergedElapsed = Math.max(nativeSwElapsedNow, incomingSwElapsed);
                    s.swElapsedMs = mergedElapsed;
                    if (mergedElapsed > nativeSwElapsedNow + 150L) {
                        s.swBaseElapsedMs = mergedElapsed;
                        s.swStartedAt = now;
                    }
                } else {
                    long startElapsed = Math.max(0L, incomingSwElapsed);
                    s.swElapsedMs = startElapsed;
                    s.swBaseElapsedMs = startElapsed;
                    s.swStartedAt = now;
                }
                s.toggleTitle = "⏸";
            } else {
                long pausedElapsed;
                if (MODE_STOPWATCH.equals(prevMode) && prevRunning) {
                    pausedElapsed = nativeSwElapsedNow;
                } else {
                    pausedElapsed = Math.max(s.swElapsedMs, incomingSwElapsed);
                }
                s.swElapsedMs = Math.max(0L, pausedElapsed);
                s.swBaseElapsedMs = s.swElapsedMs;
                s.swStartedAt = 0L;
                s.toggleTitle = "▶";
            }
        } else if (MODE_TIMER.equals(s.mode)) {
            s.tmTotalMs = incomingTimerTotal;

            if (s.running) {
                long mergedRemaining;
                if (MODE_TIMER.equals(prevMode) && prevRunning) {
                    mergedRemaining = Math.min(nativeTimerRemainingNow, incomingTimerRemaining);
                } else {
                    mergedRemaining = incomingTimerRemaining;
                }
                s.tmRemainingMs = Math.max(0L, mergedRemaining);
                s.tmEndsAt = now + s.tmRemainingMs;
                s.toggleTitle = "⏸";
            } else {
                long pausedRemaining;
                if (MODE_TIMER.equals(prevMode) && prevRunning) {
                    pausedRemaining = Math.min(nativeTimerRemainingNow, incomingTimerRemaining);
                } else {
                    pausedRemaining = incomingTimerRemaining;
                }
                s.tmRemainingMs = Math.max(0L, pausedRemaining);
                s.tmEndsAt = 0L;
                s.toggleTitle = "▶";
            }
        } else if (MODE_TABATA.equals(s.mode)) {
            final boolean incomingPhaseOpen = isTabataOpenStatus(s.tbStatus);

            boolean incomingRegression = false;
            if (MODE_TABATA.equals(prevMode) && prevRunning) {
                incomingRegression = isTabataRegression(
                    prevTbStatus,
                    prevTbRound,
                    prevTbRounds,
                    s.tbStatus,
                    s.tbRound,
                    s.tbRounds
                );

                // Protect native progress: ignore stale JS phase/round rollback.
                if (incomingRegression) {
                    s.tbStatus = prevTbStatus;
                    s.tbRound = Math.max(1, prevTbRound);
                    s.tbRounds = Math.max(1, Math.max(prevTbRounds, s.tbRounds));
                    if (prevTbPhaseDuration > 0L) {
                        s.tbPhaseDuration = prevTbPhaseDuration;
                    }
                }
            }

            if (s.running) {
                long mergedRemaining;
                long incomingRemainingSafe = incomingTabataRemaining;

                if (incomingRegression) {
                    incomingRemainingSafe = nativeTabataRemainingNow > 0L
                        ? nativeTabataRemainingNow
                        : Math.max(1L, s.tbPhaseDuration);
                }

                if (MODE_TABATA.equals(prevMode) && prevRunning) {
                    boolean phaseChanged =
                        !stringEq(prevTbStatus, s.tbStatus)
                            || prevTbRound != s.tbRound
                            || prevTbPhaseDuration != s.tbPhaseDuration;

                    if (phaseChanged) {
                        long phaseDefault = phaseDurationForStatus(s, s.tbStatus);

                        if (incomingRemainingSafe > 0L) {
                            mergedRemaining = incomingRemainingSafe;
                        } else if (nativeTabataRemainingNow > 0L) {
                            mergedRemaining = nativeTabataRemainingNow;
                        } else {
                            mergedRemaining = phaseDefault;
                        }
                    } else {
                        long candidate = incomingRemainingSafe;

                        // Protect against stale zero from JS that can force 00:00 mid-phase.
                        if (candidate <= 0L && incomingPhaseOpen) {
                            if (nativeTabataRemainingNow > 0L) {
                                candidate = nativeTabataRemainingNow;
                            } else {
                                candidate = Math.max(1L, s.tbPhaseDuration);
                            }
                        }

                        if (nativeTabataRemainingNow > 0L) {
                            if (candidate <= 0L) {
                                candidate = nativeTabataRemainingNow;
                            }

                            // Не разрешаем рост remaining внутри одной фазы.
                            if (candidate > nativeTabataRemainingNow) {
                                candidate = nativeTabataRemainingNow;
                            }

                            // Слишком резкий провал тоже считаем шумом.
                            if (candidate < nativeTabataRemainingNow - 1500L) {
                                candidate = nativeTabataRemainingNow;
                            }
                        }

                        mergedRemaining = candidate;
                    }
                } else {
                    mergedRemaining = incomingRemainingSafe;
                }

                if (incomingPhaseOpen) {
                    s.tbRemainingMs = Math.max(1L, mergedRemaining);
                } else {
                    s.tbRemainingMs = Math.max(0L, mergedRemaining);
                }

                s.tbEndsAt = now + s.tbRemainingMs;
                s.toggleTitle = "⏸";
            } else {
                long pausedRemaining;
                if (MODE_TABATA.equals(prevMode) && prevRunning) {
                    pausedRemaining = Math.min(nativeTabataRemainingNow, incomingTabataRemaining);
                } else {
                    pausedRemaining = incomingTabataRemaining;
                }

                if (pausedRemaining <= 0L && incomingPhaseOpen) {
                    pausedRemaining = Math.max(1L, s.tbPhaseDuration);
                }

                s.tbRemainingMs = Math.max(0L, pausedRemaining);
                s.tbEndsAt = 0L;
                s.toggleTitle = "▶";
            }
        } else {
            s.running = false;
            s.toggleTitle = "▶";
        }

        write(s);
    }

    public RuntimeState toggle() {
        RuntimeState s = read();
        long now = System.currentTimeMillis();

        if (MODE_STOPWATCH.equals(s.mode)) {
            if (s.running) {
                long elapsedNow = Math.max(0L, s.swBaseElapsedMs + (now - s.swStartedAt));
                s.swElapsedMs = elapsedNow;
                s.running = false;
                s.swStartedAt = 0L;
                s.toggleTitle = "▶";
            } else {
                s.running = true;
                s.swBaseElapsedMs = s.swElapsedMs;
                s.swStartedAt = now;
                s.toggleTitle = "⏸";
            }

            if (isBlank(s.notifTitle)) s.notifTitle = "Stopwatch";
            long elapsed = getStopwatchElapsedNow(s, now);
            s.notifBody = formatTime(elapsed, elapsed >= 3600000L);
        } else if (MODE_TIMER.equals(s.mode)) {
            if (s.running) {
                long rem = Math.max(0L, s.tmEndsAt - now);
                s.tmRemainingMs = rem;
                s.tmEndsAt = 0L;
                s.running = false;
                s.toggleTitle = "▶";
            } else if (s.tmRemainingMs > 0L) {
                s.tmEndsAt = now + s.tmRemainingMs;
                s.running = true;
                s.toggleTitle = "⏸";
            }

            if (isBlank(s.notifTitle)) s.notifTitle = "Timer";
            long rem = getTimerRemainingNow(s, now);
            s.notifBody = formatTime(rem, s.tmTotalMs >= 3600000L);
        } else if (MODE_TABATA.equals(s.mode)) {
            if (s.running) {
                long rem = Math.max(0L, s.tbEndsAt - now);
                s.tbRemainingMs = rem;
                s.tbEndsAt = 0L;
                s.running = false;
                s.toggleTitle = "▶";
            } else if (s.tbRemainingMs > 0L
                && !"STOPPED".equals(s.tbStatus)
                && !"COMPLETED".equals(s.tbStatus)) {
                s.tbEndsAt = now + s.tbRemainingMs;
                s.running = true;
                s.toggleTitle = "⏸";
            }

            s.notifTitle = buildTabataTitle(s);
            long rem = getTabataRemainingNow(s, now);
            s.notifBody = formatTime(rem, false);
        } else {
            s.running = false;
            s.toggleTitle = "▶";
        }

        s.updatedAt = now;
        write(s);
        return s;
    }

    public NotificationPayload computeDisplayNow() {
        RuntimeState s = read();
        long now = System.currentTimeMillis();

        boolean changed = normalizeCompletionIfNeeded(s, now);
        if (changed) write(s);

        NotificationPayload p = new NotificationPayload();
        p.channelId = isBlank(s.channelId) ? AppForegroundService.CHANNEL_ID : s.channelId;
        p.isDarkTheme = s.isDarkTheme;
        p.accentColor = isBlank(s.accentColor) ? "#3399ff" : s.accentColor;
        p.onAccentColor = isBlank(s.onAccentColor) ? "#ffffff" : s.onAccentColor;
        p.toggleTitle = s.running ? "⏸" : "▶";

        if (MODE_STOPWATCH.equals(s.mode)) {
            long elapsed = getStopwatchElapsedNow(s, now);
            p.title = isBlank(s.notifTitle) ? "Stopwatch" : s.notifTitle;
            p.body = formatTime(elapsed, elapsed >= 3600000L);
            return p;
        }

        if (MODE_TIMER.equals(s.mode)) {
            long rem = getTimerRemainingNow(s, now);
            p.title = isBlank(s.notifTitle) ? "Timer" : s.notifTitle;
            p.body = formatTime(rem, s.tmTotalMs >= 3600000L);
            return p;
        }

        if (MODE_TABATA.equals(s.mode)) {
            long rem = getTabataRemainingNow(s, now);
            p.title = buildTabataTitle(s);
            p.body = formatTime(rem, false);
            return p;
        }

        p.title = isBlank(s.notifTitle) ? "Stopwatch" : s.notifTitle;
        p.body = isBlank(s.notifBody) ? "00:00" : s.notifBody;
        return p;
    }

    private boolean normalizeCompletionIfNeeded(RuntimeState s, long now) {
        boolean changed = false;

        if (MODE_TIMER.equals(s.mode) && s.running) {
            long rem = Math.max(0L, s.tmEndsAt - now);
            if (rem <= 0L) {
                s.running = false;
                s.tmRemainingMs = 0L;
                s.tmEndsAt = 0L;
                s.toggleTitle = "▶";
                s.updatedAt = now;
                changed = true;
            }
        }

        if (MODE_TABATA.equals(s.mode) && s.running) {
            long rem = Math.max(0L, s.tbEndsAt - now);
            if (rem <= 0L) {
                long overdue = Math.max(0L, now - s.tbEndsAt);

                if (advanceTabataPhase(s, now)) {
                    changed = true;

                    while (overdue > 0L && s.running) {
                        long phaseLen = Math.max(1L, s.tbPhaseDuration);

                        if (overdue >= phaseLen) {
                            overdue -= phaseLen;
                            if (!advanceTabataPhase(s, now)) {
                                break;
                            }
                        } else {
                            long remaining = Math.max(1L, phaseLen - overdue);
                            s.tbRemainingMs = remaining;
                            s.tbEndsAt = now + remaining;
                            changed = true;
                            overdue = 0L;
                        }
                    }
                } else {
                    changed = true;
                }

                s.updatedAt = now;
            }
        }

        return changed;
    }

    private long phaseDurationForStatus(RuntimeState s, String status) {
        if ("READY".equals(status)) return Math.max(1L, s.tbReadyMs);
        if ("WORK".equals(status)) return Math.max(1L, s.tbWorkMs);
        if ("REST".equals(status)) return Math.max(1L, s.tbRestMs);
        return Math.max(1L, s.tbPhaseDuration);
    }

    private int tabataPhaseOrder(String status) {
        if ("READY".equals(status)) return 0;
        if ("WORK".equals(status)) return 1;
        if ("REST".equals(status)) return 2;
        if ("STOPPED".equals(status)) return -1;
        if ("COMPLETED".equals(status)) return 3;
        return -1;
    }

    private int tabataProgressOrdinal(String status, int round, int rounds) {
        int safeRound = Math.max(1, round);
        int safeRounds = Math.max(1, rounds);
        int boundedRound = Math.min(safeRounds, safeRound);

        int phaseOrder = tabataPhaseOrder(status);
        if (phaseOrder < 0) return -1;

        return (boundedRound - 1) * 4 + phaseOrder;
    }

    private boolean isTabataRegression(
        String prevStatus,
        int prevRound,
        int prevRounds,
        String incomingStatus,
        int incomingRound,
        int incomingRounds
    ) {
        int prevOrd = tabataProgressOrdinal(prevStatus, prevRound, prevRounds);
        int incomingOrd = tabataProgressOrdinal(incomingStatus, incomingRound, incomingRounds);

        if (prevOrd < 0 || incomingOrd < 0) return false;
        return incomingOrd < prevOrd;
    }

    private boolean isTabataOpenStatus(String status) {
        return "READY".equals(status) || "WORK".equals(status) || "REST".equals(status);
    }

    private boolean advanceTabataPhase(RuntimeState s, long now) {
        if ("READY".equals(s.tbStatus)) {
            s.tbStatus = "WORK";
            s.tbRound = Math.max(1, s.tbRound);
            s.tbPhaseDuration = phaseDurationForStatus(s, "WORK");
            s.tbRemainingMs = s.tbPhaseDuration;
            s.tbEndsAt = now + s.tbRemainingMs;
            s.toggleTitle = "⏸";
            return true;
        }

        if ("WORK".equals(s.tbStatus)) {
            if (s.tbRound >= s.tbRounds) {
                s.running = false;
                s.tbStatus = "COMPLETED";
                s.tbRemainingMs = 0L;
                s.tbEndsAt = 0L;
                s.toggleTitle = "▶";
                return false;
            }

            s.tbStatus = "REST";
            s.tbPhaseDuration = phaseDurationForStatus(s, "REST");
            s.tbRemainingMs = s.tbPhaseDuration;
            s.tbEndsAt = now + s.tbRemainingMs;
            s.toggleTitle = "⏸";
            return true;
        }

        if ("REST".equals(s.tbStatus)) {
            s.tbRound = Math.min(s.tbRounds, Math.max(1, s.tbRound + 1));
            s.tbStatus = "WORK";
            s.tbPhaseDuration = phaseDurationForStatus(s, "WORK");
            s.tbRemainingMs = s.tbPhaseDuration;
            s.tbEndsAt = now + s.tbRemainingMs;
            s.toggleTitle = "⏸";
            return true;
        }

        s.running = false;
        s.tbStatus = "STOPPED";
        s.tbRemainingMs = 0L;
        s.tbEndsAt = 0L;
        s.toggleTitle = "▶";
        return false;
    }

    private String buildTabataTitle(RuntimeState s) {
        boolean ru = isRussianLocale();

        String defaultTabataWord = ru ? "Табата" : "Tabata";
        String workoutRaw = isBlank(s.tbWorkoutName) ? defaultTabataWord : s.tbWorkoutName;

        // If workout name stayed as default English literal, localize it too.
        String workout = "Tabata".equalsIgnoreCase(workoutRaw) ? defaultTabataWord : workoutRaw;

        String phase = localizeTabataStatus(s.tbStatus, ru);
        String roundWord = ru ? "РАУНД" : "ROUND";

        return defaultTabataWord + " - " + workout + " • " + roundWord + " " + s.tbRound + "/" + s.tbRounds + " • " + phase;
    }

    private String localizeTabataStatus(String status, boolean ru) {
        String v = status == null ? "STOPPED" : status;
        if (!ru) {
            if ("READY".equals(v)) return "Get Ready";
            if ("WORK".equals(v)) return "Work";
            if ("REST".equals(v)) return "Rest";
            if ("STOPPED".equals(v)) return "Pause";
            if ("COMPLETED".equals(v)) return "Completed";
            return v;
        }

        if ("READY".equals(v)) return "ПРИГОТОВЬТЕСЬ";
        if ("WORK".equals(v)) return "РАБОТА";
        if ("REST".equals(v)) return "ОТДЫХ";
        if ("STOPPED".equals(v)) return "ПАУЗА";
        if ("COMPLETED".equals(v)) return "ЗАВЕРШЕНО";
        return v;
    }

    private boolean isRussianLocale() {
        try {
            String lang = Locale.getDefault().getLanguage();
            return lang != null && lang.toLowerCase().startsWith("ru");
        } catch (Throwable ignored) {
            return false;
        }
    }

    private long getStopwatchElapsedNow(RuntimeState s, long now) {
        if (s.running) return Math.max(0L, s.swBaseElapsedMs + (now - s.swStartedAt));
        return Math.max(0L, s.swElapsedMs);
    }

    private long getTimerRemainingNow(RuntimeState s, long now) {
        if (s.running) return Math.max(0L, s.tmEndsAt - now);
        return Math.max(0L, s.tmRemainingMs);
    }

    private long getTabataRemainingNow(RuntimeState s, long now) {
        if (s.running) return Math.max(0L, s.tbEndsAt - now);
        return Math.max(0L, s.tbRemainingMs);
    }

    private static boolean isBlank(String v) {
        return v == null || v.trim().isEmpty();
    }

    private static boolean stringEq(String a, String b) {
        if (a == null) return b == null;
        return a.equals(b);
    }

    private static String formatTime(long ms, boolean forceHours) {
        long totalSec = Math.max(0L, ms) / 1000L;
        long h = totalSec / 3600L;
        long m = (totalSec % 3600L) / 60L;
        long sSec = totalSec % 60L;

        if (h > 0L || forceHours) return h + ":" + pad2(m) + ":" + pad2(sSec);
        return pad2(m) + ":" + pad2(sSec);
    }

    private static String pad2(long n) {
        return n < 10L ? "0" + n : String.valueOf(n);
    }
}