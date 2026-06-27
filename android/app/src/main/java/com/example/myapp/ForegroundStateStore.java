package com.example.myapp;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

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

        // Stopwatch
        public long swElapsedMs = 0L;
        public long swStartedAt = 0L;
        public long swBaseElapsedMs = 0L;

        // Timer
        public long tmRemainingMs = 0L;
        public long tmTotalMs = 0L;
        public long tmEndsAt = 0L;

        // Tabata
        public String tbStatus = "STOPPED";
        public int tbRound = 1;
        public int tbRounds = 1;
        public String tbWorkoutName = "Tabata";
        public long tbRemainingMs = 0L;
        public long tbEndsAt = 0L;

        // Notification
        public String notifTitle = "Stopwatch";
        public String notifBody = "00:00";
        public String toggleTitle = "▶";

        // Style/channel
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
        s.tbEndsAt = prefs.getLong("tbEndsAt", 0L);

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
            .putLong("tbEndsAt", s.tbEndsAt)

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

        s.mode = runtime.optString("mode", s.mode);
        s.running = runtime.has("running") ? runtime.optBoolean("running", s.running) : s.running;
        s.updatedAt = runtime.optLong("updatedAt", System.currentTimeMillis());

        s.swElapsedMs = runtime.optLong("swElapsedMs", s.swElapsedMs);

        s.tmRemainingMs = runtime.optLong("tmRemainingMs", s.tmRemainingMs);
        s.tmTotalMs = runtime.optLong("tmTotalMs", s.tmTotalMs);

        s.tbStatus = runtime.optString("tbStatus", s.tbStatus);
        s.tbRound = runtime.optInt("tbRound", s.tbRound);
        s.tbRounds = runtime.optInt("tbRounds", s.tbRounds);
        s.tbWorkoutName = runtime.optString("tbWorkoutName", s.tbWorkoutName);
        s.tbRemainingMs = runtime.optLong("tbRemainingMs", s.tbRemainingMs);

        s.notifTitle = runtime.optString("notifTitle", s.notifTitle);
        s.notifBody = runtime.optString("notifBody", s.notifBody);

        s.channelId = runtime.optString("channelId", s.channelId);
        s.isDarkTheme = runtime.has("isDarkTheme") ? runtime.optBoolean("isDarkTheme", s.isDarkTheme) : s.isDarkTheme;
        s.accentColor = runtime.optString("accentColor", s.accentColor);
        s.onAccentColor = runtime.optString("onAccentColor", s.onAccentColor);

        long now = System.currentTimeMillis();

        if (MODE_STOPWATCH.equals(s.mode)) {
            if (s.running) {
                s.swBaseElapsedMs = s.swElapsedMs;
                s.swStartedAt = now;
                s.toggleTitle = "⏸";
            } else {
                s.swStartedAt = 0L;
                s.swBaseElapsedMs = s.swElapsedMs;
                s.toggleTitle = "▶";
            }
        } else if (MODE_TIMER.equals(s.mode)) {
            if (s.running) {
                s.tmEndsAt = now + Math.max(0L, s.tmRemainingMs);
                s.toggleTitle = "⏸";
            } else {
                s.tmEndsAt = 0L;
                s.toggleTitle = "▶";
            }
        } else if (MODE_TABATA.equals(s.mode)) {
            if (s.running) {
                s.tbEndsAt = now + Math.max(0L, s.tbRemainingMs);
                s.toggleTitle = "⏸";
            } else {
                s.tbEndsAt = 0L;
                s.toggleTitle = "▶";
            }
        } else {
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
            } else {
                if (s.tmRemainingMs > 0L) {
                    s.tmEndsAt = now + s.tmRemainingMs;
                    s.running = true;
                    s.toggleTitle = "⏸";
                }
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
            } else {
                if (s.tbRemainingMs > 0L && !"STOPPED".equals(s.tbStatus)) {
                    s.tbEndsAt = now + s.tbRemainingMs;
                    s.running = true;
                    s.toggleTitle = "⏸";
                }
            }

            String workout = isBlank(s.tbWorkoutName) ? "Tabata" : s.tbWorkoutName;
            String phase = "STOPPED".equals(s.tbStatus) ? "Pause" : s.tbStatus;
            s.notifTitle = "Tabata - " + workout + " • ROUND " + s.tbRound + "/" + s.tbRounds + " • " + phase;
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
        if (changed) {
            write(s);
        }

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
            p.title = isBlank(s.notifTitle) ? "Tabata" : s.notifTitle;
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
                s.running = false;
                s.tbRemainingMs = 0L;
                s.tbEndsAt = 0L;
                s.toggleTitle = "▶";
                s.updatedAt = now;
                changed = true;
            }
        }

        return changed;
    }

    private long getStopwatchElapsedNow(RuntimeState s, long now) {
        if (s.running) {
            return Math.max(0L, s.swBaseElapsedMs + (now - s.swStartedAt));
        }
        return Math.max(0L, s.swElapsedMs);
    }

    private long getTimerRemainingNow(RuntimeState s, long now) {
        if (s.running) {
            return Math.max(0L, s.tmEndsAt - now);
        }
        return Math.max(0L, s.tmRemainingMs);
    }

    private long getTabataRemainingNow(RuntimeState s, long now) {
        if (s.running) {
            return Math.max(0L, s.tbEndsAt - now);
        }
        return Math.max(0L, s.tbRemainingMs);
    }

    private static boolean isBlank(String v) {
        return v == null || v.trim().isEmpty();
    }

    private static String formatTime(long ms, boolean forceHours) {
        long totalSec = Math.max(0L, ms) / 1000L;
        long h = totalSec / 3600L;
        long m = (totalSec % 3600L) / 60L;
        long s = totalSec % 60L;

        if (h > 0L || forceHours) {
            return h + ":" + pad2(m) + ":" + pad2(s);
        }
        return pad2(m) + ":" + pad2(s);
    }

    private static String pad2(long n) {
        return n < 10L ? "0" + n : String.valueOf(n);
    }
}