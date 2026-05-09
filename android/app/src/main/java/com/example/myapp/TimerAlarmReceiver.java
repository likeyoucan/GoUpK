package com.example.myapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class TimerAlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_TIMER_ALARM = "com.example.myapp.ACTION_TIMER_ALARM";
    public static final String EXTRA_REQUEST_CODE = "requestCode";
    public static final String EXTRA_TRIGGER_AT = "triggerAt";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (!ACTION_TIMER_ALARM.equals(action)) return;

        int requestCode = intent.getIntExtra(EXTRA_REQUEST_CODE, -1);
        long triggerAt = intent.getLongExtra(EXTRA_TRIGGER_AT, 0L);

        Log.i("TimerAlarmReceiver", "Alarm fired. requestCode=" + requestCode + ", triggerAt=" + triggerAt);

        context.getSharedPreferences("timer_alarm_bridge", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("timer_alarm_fired", true)
            .putLong("timer_alarm_fired_at", System.currentTimeMillis())
            .putInt("timer_alarm_request_code", requestCode)
            .apply();
    }
}