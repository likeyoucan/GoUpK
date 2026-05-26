package com.example.myapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

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

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel(CHANNEL_ID, "Stopwatch Pro", "Foreground timer controls");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP_SERVICE.equals(action)) {
            stopServiceSafe();
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        String toggle = intent.getStringExtra(EXTRA_TOGGLE);
        String stop = intent.getStringExtra(EXTRA_STOP);
        String channelId = intent.getStringExtra(EXTRA_CHANNEL_ID);

        if (channelId == null || channelId.trim().isEmpty()) {
            channelId = CHANNEL_ID;
        }

        ensureChannel(channelId, "Stopwatch Pro", "Foreground timer controls");

        Notification notification = buildNotification(
            channelId,
            title != null ? title : "Stopwatch",
            body != null ? body : "00:00",
            toggle != null ? toggle : "Pause",
            stop != null ? stop : "Stop"
        );

        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    private Notification buildNotification(
        String channelId,
        String title,
        String body,
        String toggleText,
        String stopText
    ) {
        PendingIntent togglePi = PendingIntent.getBroadcast(
            this,
            201,
            new Intent(this, ForegroundActionReceiver.class).setAction(ACTION_BTN_TOGGLE),
            pendingFlags()
        );

        PendingIntent stopPi = PendingIntent.getBroadcast(
            this,
            202,
            new Intent(this, ForegroundActionReceiver.class).setAction(ACTION_BTN_STOP),
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

        return new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, toggleText, togglePi)
            .addAction(0, stopText, stopPi)
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

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}