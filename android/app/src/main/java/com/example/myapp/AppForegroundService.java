package com.example.myapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

public class AppForegroundService extends Service {
    public static final String CHANNEL_ID = "stopwatch_channel_custom_v1";
    public static final int NOTIFICATION_ID = 101;

    public static final String ACTION_START_OR_UPDATE = "com.example.myapp.FG_START_OR_UPDATE";
    public static final String ACTION_STOP_SERVICE = "com.example.myapp.FG_STOP_SERVICE";

    public static final String ACTION_BTN_TOGGLE = "com.example.myapp.FG_BTN_TOGGLE";
    public static final String ACTION_BTN_STOP = "com.example.myapp.FG_BTN_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_TOGGLE = "toggle";
    public static final String EXTRA_STOP = "stop";

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP_SERVICE.equals(action)) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        String toggle = intent.getStringExtra(EXTRA_TOGGLE);
        String stop = intent.getStringExtra(EXTRA_STOP);

        Notification notification = buildNotification(
            title != null ? title : "Stopwatch",
            body != null ? body : "00:00",
            toggle != null ? toggle : "Pause",
            stop != null ? stop : "Stop"
        );

        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    private Notification buildNotification(String title, String body, String toggleText, String stopText) {
        RemoteViews rv = new RemoteViews(getPackageName(), R.layout.notification_timer);
        rv.setTextViewText(R.id.notif_title, title);
        rv.setTextViewText(R.id.notif_body, body);
        rv.setTextViewText(R.id.notif_btn_toggle, toggleText);
        rv.setTextViewText(R.id.notif_btn_stop, stopText);

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

        rv.setOnClickPendingIntent(R.id.notif_btn_toggle, togglePi);
        rv.setOnClickPendingIntent(R.id.notif_btn_stop, stopPi);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setContentTitle(title)
            .setContentText(body)
            .setCustomContentView(rv)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .build();
    }

    private int pendingFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.FLAG_UPDATE_CURRENT;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Stopwatch Pro",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Foreground timer controls");
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}