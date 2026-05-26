package com.example.myapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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
    public static final String ACTION_BTN_STOP = "com.example.myapp.FG_BTN_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_TOGGLE = "toggle";
    public static final String EXTRA_STOP = "stop";
    public static final String EXTRA_CHANNEL_ID = "channelId";

    public static final String EXTRA_BG_COLOR = "bgColor";
    public static final String EXTRA_TEXT_PRIMARY_COLOR = "textPrimaryColor";
    public static final String EXTRA_TEXT_SECONDARY_COLOR = "textSecondaryColor";
    public static final String EXTRA_BUTTON_BG_COLOR = "buttonBgColor";
    public static final String EXTRA_BUTTON_ICON_COLOR = "buttonIconColor";

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
        if (intent == null) return START_STICKY;

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

            String bgColor = intent.getStringExtra(EXTRA_BG_COLOR);
            String textPrimaryColor = intent.getStringExtra(EXTRA_TEXT_PRIMARY_COLOR);
            String textSecondaryColor = intent.getStringExtra(EXTRA_TEXT_SECONDARY_COLOR);
            String buttonBgColor = intent.getStringExtra(EXTRA_BUTTON_BG_COLOR);
            String buttonIconColor = intent.getStringExtra(EXTRA_BUTTON_ICON_COLOR);

            if (channelId == null || channelId.trim().isEmpty()) {
                channelId = CHANNEL_ID;
            }

            ensureChannel(channelId, "Stopwatch Pro", "Foreground timer controls");

            Notification notification = buildNotification(
                channelId,
                title != null ? title : "Stopwatch",
                body != null ? body : "00:00",
                toggle != null ? toggle : "Pause",
                bgColor,
                textPrimaryColor,
                textSecondaryColor,
                buttonBgColor,
                buttonIconColor
            );

            startForeground(NOTIFICATION_ID, notification);
            return START_STICKY;
        } catch (Throwable t) {
            saveLastError(t);
            stopServiceSafe();
            return START_NOT_STICKY;
        }
    }

    private int parseColorSafe(String raw, String fallback) {
        try {
            return Color.parseColor(raw);
        } catch (Exception e) {
            return Color.parseColor(fallback);
        }
    }

    private void applyTheme(RemoteViews rv,
                            int bgColor,
                            int textPrimaryColor,
                            int textSecondaryColor,
                            int buttonBgColor,
                            int buttonIconColor) {
        rv.setInt(R.id.notif_root, "setBackgroundColor", bgColor);
        rv.setTextColor(R.id.notif_title, textSecondaryColor);
        rv.setTextColor(R.id.notif_body, textPrimaryColor);

        // Красим именно круг-иконку, не контейнер
        rv.setInt(R.id.notif_btn_toggle_bg, "setColorFilter", buttonBgColor);
        rv.setInt(R.id.notif_btn_toggle_icon, "setColorFilter", buttonIconColor);
    }

    private Notification buildNotification(
        String channelId,
        String title,
        String body,
        String toggleText,
        String bgColorRaw,
        String textPrimaryRaw,
        String textSecondaryRaw,
        String buttonBgRaw,
        String buttonIconRaw
    ) {
        int bgColor = parseColorSafe(bgColorRaw, "#273469");
        int textPrimaryColor = parseColorSafe(textPrimaryRaw, "#F5F7FF");
        int textSecondaryColor = parseColorSafe(textSecondaryRaw, "#BFC7D9");
        int buttonBgColor = parseColorSafe(buttonBgRaw, "#E2EAFF");
        int buttonIconColor = parseColorSafe(buttonIconRaw, "#2B3038");

        RemoteViews compact = new RemoteViews(getPackageName(), R.layout.notification_timer);
        RemoteViews big = new RemoteViews(getPackageName(), R.layout.notification_timer_big);

        compact.setTextViewText(R.id.notif_title, title);
        compact.setTextViewText(R.id.notif_body, body);

        big.setTextViewText(R.id.notif_title, title);
        big.setTextViewText(R.id.notif_body, body);

        boolean isPlay = "▶".equals(toggleText) || "Play".equalsIgnoreCase(toggleText);
        int iconRes = isPlay ? R.drawable.ic_notif_play : R.drawable.ic_notif_pause;

        compact.setImageViewResource(R.id.notif_btn_toggle_icon, iconRes);
        big.setImageViewResource(R.id.notif_btn_toggle_icon, iconRes);

        applyTheme(compact, bgColor, textPrimaryColor, textSecondaryColor, buttonBgColor, buttonIconColor);
        applyTheme(big, bgColor, textPrimaryColor, textSecondaryColor, buttonBgColor, buttonIconColor);

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

        compact.setOnClickPendingIntent(R.id.notif_btn_toggle_wrap, togglePi);
        big.setOnClickPendingIntent(R.id.notif_btn_toggle_wrap, togglePi);

        return new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setCustomContentView(compact)
            .setCustomBigContentView(big)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setColor(bgColor)
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