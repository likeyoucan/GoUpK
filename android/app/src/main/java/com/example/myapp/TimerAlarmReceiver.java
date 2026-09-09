package com.example.myapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class TimerAlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_TIMER_ALARM = "com.example.myapp.ACTION_TIMER_ALARM";
    public static final String EXTRA_REQUEST_CODE = "requestCode";
    public static final String EXTRA_TRIGGER_AT = "triggerAt";

    private static final String PREFS_NAME = "timer_alarm_bridge";
    private static final String KEY_FIRED = "timer_alarm_fired";
    private static final String KEY_FIRED_AT = "timer_alarm_fired_at";
    private static final String KEY_FIRED_REQUEST_CODE = "timer_alarm_request_code";

    private static final String FINISH_CHANNEL_ID = "stopwatch_timer_finish_v1";
    private static final int FINISH_NOTIFICATION_ID = 1002;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (!ACTION_TIMER_ALARM.equals(action)) return;

        int requestCode = intent.getIntExtra(EXTRA_REQUEST_CODE, -1);
        long triggerAt = intent.getLongExtra(EXTRA_TRIGGER_AT, 0L);

        Log.i("TimerAlarmReceiver", "Alarm fired. requestCode=" + requestCode + ", triggerAt=" + triggerAt);

        long now = System.currentTimeMillis();

        // 1) Persist fired flag for JS bridge reconciliation.
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_FIRED, true)
            .putLong(KEY_FIRED_AT, now)
            .putInt(KEY_FIRED_REQUEST_CODE, requestCode)
            .apply();

        // 2) Normalize native runtime timer state so foreground banner does not keep stale "running" timer.
        ForegroundStateStore store = new ForegroundStateStore(context);
        ForegroundStateStore.RuntimeState state = store.read();

        if (ForegroundStateStore.MODE_TIMER.equals(state.mode)) {
            state.running = false;
            state.tmRemainingMs = 0L;
            state.tmEndsAt = 0L;
            state.toggleTitle = "▶";
            state.updatedAt = now;

            // Keep title if it was custom; ensure body is reset.
            if (isBlank(state.notifTitle)) {
                state.notifTitle = "Timer";
            }
            state.notifBody = "00:00";

            store.write(state);

            // Ask foreground service to refresh notification immediately from updated state.
            Intent serviceIntent = new Intent(context, AppForegroundService.class);
            serviceIntent.setAction(AppForegroundService.ACTION_START_OR_UPDATE);
            serviceIntent.putExtra(AppForegroundService.EXTRA_TITLE, state.notifTitle);
            serviceIntent.putExtra(AppForegroundService.EXTRA_BODY, state.notifBody);
            serviceIntent.putExtra(AppForegroundService.EXTRA_TOGGLE, state.toggleTitle);
            serviceIntent.putExtra(AppForegroundService.EXTRA_CHANNEL_ID, state.channelId);
            serviceIntent.putExtra(AppForegroundService.EXTRA_IS_DARK_THEME, state.isDarkTheme);
            serviceIntent.putExtra(AppForegroundService.EXTRA_ACCENT_COLOR, state.accentColor);
            serviceIntent.putExtra(AppForegroundService.EXTRA_ON_ACCENT_COLOR, state.onAccentColor);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }

        // 3) Local completion notification fallback (works even if WebView is sleeping).
        showTimerFinishedNotification(context);
    }

    private void showTimerFinishedNotification(Context context) {
        ensureFinishChannel(context);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            10021,
            openIntent,
            flags
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, FINISH_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setContentTitle("Timer Finished")
            .setContentText("00:00")
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(FINISH_NOTIFICATION_ID, builder.build());
        }
    }

    private void ensureFinishChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel channel = new NotificationChannel(
            FINISH_CHANNEL_ID,
            "Timer Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Timer completion alerts");
        channel.enableVibration(true);

        nm.createNotificationChannel(channel);
    }

    private static boolean isBlank(String v) {
        return v == null || v.trim().isEmpty();
    }
}