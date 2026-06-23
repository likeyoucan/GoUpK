package com.example.myapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.IBinder;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

public class AppForegroundService extends Service {
    public static final String CHANNEL_ID = "stopwatch_channel_silent_v2";
    public static final int NOTIFICATION_ID = 101;

    public static final String ACTION_START_OR_UPDATE = "com.example.myapp.FG_START_OR_UPDATE";
    public static final String ACTION_STOP_SERVICE = "com.example.myapp.FG_STOP_SERVICE";

    public static final String ACTION_BTN_TOGGLE = "com.example.myapp.FG_BTN_TOGGLE";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_TOGGLE = "toggle";
    public static final String EXTRA_CHANNEL_ID = "channelId";
    public static final String EXTRA_IS_DARK_THEME = "isDarkTheme";

    // Accent colors from JS/CSS resolved theme
    public static final String EXTRA_ACCENT_COLOR = "accentColor";
    public static final String EXTRA_ON_ACCENT_COLOR = "onAccentColor";

    private static final String DIAG_PREFS = "fg_diag";
    private static final String KEY_LAST_ERROR = "last_error";
    private static final String KEY_LAST_ERROR_AT = "last_error_at";

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel(CHANNEL_ID, "Stopwatch Pro", "Foreground timer controls");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        try {
            String action = intent.getAction();

            if (ACTION_STOP_SERVICE.equals(action)) {
                stopServiceSafe();
                return START_NOT_STICKY;
            }

            String title = intent.getStringExtra(EXTRA_TITLE);
            String body = intent.getStringExtra(EXTRA_BODY);
            String toggle = intent.getStringExtra(EXTRA_TOGGLE);
            String channelId = intent.getStringExtra(EXTRA_CHANNEL_ID);

            boolean isDarkTheme = intent.hasExtra(EXTRA_IS_DARK_THEME)
                ? intent.getBooleanExtra(EXTRA_IS_DARK_THEME, false)
                : isDeviceDarkTheme();

            String accentColorHex = intent.getStringExtra(EXTRA_ACCENT_COLOR);
            String onAccentColorHex = intent.getStringExtra(EXTRA_ON_ACCENT_COLOR);

            if (channelId == null || channelId.trim().isEmpty()) {
                channelId = CHANNEL_ID;
            }

            ensureChannel(channelId, "Stopwatch Pro", "Foreground timer controls");

            Notification notification = buildNotification(
                channelId,
                title != null ? title : "Stopwatch",
                body != null ? body : "00:00",
                toggle != null ? toggle : "Pause",
                isDarkTheme,
                accentColorHex,
                onAccentColorHex
            );

            startForeground(NOTIFICATION_ID, notification);
            return START_NOT_STICKY;
        } catch (Throwable t) {
            saveLastError(t);
            stopServiceSafe();
            return START_NOT_STICKY;
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopServiceSafe();
        super.onTaskRemoved(rootIntent);
    }

    private boolean isDeviceDarkTheme() {
        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
    }

    private int parseColorOr(String hex, int fallback) {
        if (hex == null) return fallback;
        try {
            return Color.parseColor(hex);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private void applyRemoteViewsState(
        RemoteViews views,
        String title,
        String body,
        boolean isPlay,
        int titleColor,
        int bodyColor,
        int buttonBgColor,
        int buttonIconColor,
        PendingIntent togglePi
    ) {
        views.setTextViewText(R.id.notif_title, title);
        views.setTextViewText(R.id.notif_body, body);

        views.setTextColor(R.id.notif_title, titleColor);
        views.setTextColor(R.id.notif_body, bodyColor);

        views.setInt(R.id.notif_btn_toggle_bg, "setColorFilter", buttonBgColor);
        views.setInt(R.id.notif_btn_toggle_icon, "setColorFilter", buttonIconColor);

        views.setImageViewResource(
            R.id.notif_btn_toggle_icon,
            isPlay ? R.drawable.ic_notif_play : R.drawable.ic_notif_pause
        );

        views.setOnClickPendingIntent(R.id.notif_btn_toggle_wrap, togglePi);
    }

    private Notification buildNotification(
        String channelId,
        String title,
        String body,
        String toggleText,
        boolean isDarkTheme,
        String accentColorHex,
        String onAccentColorHex
    ) {
        int textSecondaryColor = isDarkTheme ? Color.parseColor("#BDC5DA") : Color.parseColor("#5D6781");

        int defaultAccent = isDarkTheme ? Color.parseColor("#4ade80") : Color.parseColor("#3399FF");
        int defaultOnAccent = Color.parseColor("#FFFFFF");

        int accentColor = parseColorOr(accentColorHex, defaultAccent);
        int onAccentColor = parseColorOr(onAccentColorHex, defaultOnAccent);

        // Время окрашиваем в акцент
        int timeColor = accentColor;

        boolean isPlay = "▶".equals(toggleText) || "Play".equalsIgnoreCase(toggleText);

        PendingIntent togglePi = PendingIntent.getBroadcast(
            this,
            201,
            new Intent(this, ForegroundActionReceiver.class).setAction(ACTION_BTN_TOGGLE),
            pendingFlags()
        );

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent contentPi = PendingIntent.getActivity(
            this,
            203,
            openIntent,
            pendingFlags()
        );

        // Separate compact/big layouts reduce visual jump when expanding/collapsing.
        RemoteViews compact = new RemoteViews(getPackageName(), R.layout.notification_timer);
        RemoteViews expanded = new RemoteViews(getPackageName(), R.layout.notification_timer_big);

        applyRemoteViewsState(
            compact,
            title,
            body,
            isPlay,
            textSecondaryColor,
            timeColor,
            accentColor,
            onAccentColor,
            togglePi
        );

        applyRemoteViewsState(
            expanded,
            title,
            body,
            isPlay,
            textSecondaryColor,
            timeColor,
            accentColor,
            onAccentColor,
            togglePi
        );

        return new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setCustomContentView(compact)
            .setCustomBigContentView(expanded)
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setColor(accentColor)
            .setColorized(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private int pendingFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.FLAG_UPDATE_CURRENT;
    }

    private void ensureChannel(String id, String name, String description) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel channel = new NotificationChannel(
            id,
            name,
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(description);
        channel.setSound(null, null);
        channel.enableVibration(false);
        nm.createNotificationChannel(channel);
    }

    private void stopServiceSafe() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}

        stopSelf();
    }

    private void saveLastError(Throwable t) {
        String msg = t.getClass().getName() + ": " + (t.getMessage() == null ? "" : t.getMessage());
        getSharedPreferences(DIAG_PREFS, MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_ERROR, msg)
            .putLong(KEY_LAST_ERROR_AT, System.currentTimeMillis())
            .apply();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}