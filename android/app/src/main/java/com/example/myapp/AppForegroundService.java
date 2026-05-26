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
import android.util.TypedValue;
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

            if (channelId == null || channelId.trim().isEmpty()) {
                channelId = CHANNEL_ID;
            }

            ensureChannel(channelId, "Stopwatch Pro", "Foreground timer controls");

            Notification notification = buildNotification(
                channelId,
                title != null ? title : "Stopwatch",
                body != null ? body : "00:00",
                toggle != null ? toggle : "Pause"
            );

            startForeground(NOTIFICATION_ID, notification);
            return START_STICKY;
        } catch (Throwable t) {
            saveLastError(t);
            stopServiceSafe();
            return START_NOT_STICKY;
        }
    }

    private boolean isDeviceDarkTheme() {
        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
    }

    private float[] resolveAdaptiveSizes() {
        // screenWidthDp доступен и стабилен для адаптации compact уведомления
        int swDp = getResources().getConfiguration().screenWidthDp;

        // titleSp, bodySp
        if (swDp >= 900) return new float[] { 13f, 34f };
        if (swDp >= 700) return new float[] { 12.5f, 32f };
        if (swDp >= 500) return new float[] { 12f, 30f };
        return new float[] { 11.5f, 28f };
    }

    private Notification buildNotification(
        String channelId,
        String title,
        String body,
        String toggleText
    ) {
        boolean dark = isDeviceDarkTheme();

        // Цвет по теме устройства
        int bgColor = dark ? Color.parseColor("#273469") : Color.parseColor("#E9EDF8");
        int textPrimaryColor = dark ? Color.parseColor("#F3F6FF") : Color.parseColor("#22315F");
        int textSecondaryColor = dark ? Color.parseColor("#B7C1DB") : Color.parseColor("#5C688A");
        int buttonBgColor = dark ? Color.parseColor("#DDE5FA") : Color.parseColor("#2A3A70");
        int buttonIconColor = dark ? Color.parseColor("#26324A") : Color.parseColor("#F3F6FF");

        float[] sz = resolveAdaptiveSizes();
        float titleSp = sz[0];
        float bodySp = sz[1];

        RemoteViews compact = new RemoteViews(getPackageName(), R.layout.notification_timer);
        compact.setTextViewText(R.id.notif_title, title);
        compact.setTextViewText(R.id.notif_body, body);

        compact.setTextViewTextSize(R.id.notif_title, TypedValue.COMPLEX_UNIT_SP, titleSp);
        compact.setTextViewTextSize(R.id.notif_body, TypedValue.COMPLEX_UNIT_SP, bodySp);

        // Единый цвет внутри кастомной части
        compact.setInt(R.id.notif_root, "setBackgroundColor", bgColor);
        compact.setTextColor(R.id.notif_title, textSecondaryColor);
        compact.setTextColor(R.id.notif_body, textPrimaryColor);

        // Кнопка круглая через отдельный круговой drawable
        compact.setInt(R.id.notif_btn_toggle_bg, "setColorFilter", buttonBgColor);
        compact.setInt(R.id.notif_btn_toggle_icon, "setColorFilter", buttonIconColor);

        boolean isPlay = "▶".equals(toggleText) || "Play".equalsIgnoreCase(toggleText);
        compact.setImageViewResource(
            R.id.notif_btn_toggle_icon,
            isPlay ? R.drawable.ic_notif_play : R.drawable.ic_notif_pause
        );

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

        return new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setCustomContentView(compact)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            // Попытка подогнать системную карточку в тот же тон
            .setColor(bgColor)
            .setColorized(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private int pendingFlags() {
        if (Build.VERSION.SDK_INT >= Build