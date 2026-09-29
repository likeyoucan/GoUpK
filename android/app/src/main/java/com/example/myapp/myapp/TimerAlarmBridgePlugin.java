package com.example.myapp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TimerAlarmBridge")
public class TimerAlarmBridgePlugin extends Plugin {

    private static final String PREFS_NAME = "timer_alarm_bridge";
    private static final String ACTION_TIMER_ALARM = TimerAlarmReceiver.ACTION_TIMER_ALARM;

    private AlarmManager getAlarmManager() {
        return (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
    }

    private PendingIntent buildPendingIntent(int requestCode, long triggerAtMillis) {
        Intent intent = new Intent(getContext(), TimerAlarmReceiver.class);
        intent.setAction(ACTION_TIMER_ALARM);
        intent.putExtra(TimerAlarmReceiver.EXTRA_REQUEST_CODE, requestCode);
        intent.putExtra(TimerAlarmReceiver.EXTRA_TRIGGER_AT, triggerAtMillis);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getBroadcast(getContext(), requestCode, intent, flags);
    }

    @PluginMethod
    public void scheduleExact(PluginCall call) {
        Long epochMs = call.getLong("epochMs");
        Integer requestCode = call.getInt("requestCode", 1001);

        if (epochMs == null || epochMs <= 0) {
            call.reject("epochMs is required and must be > 0");
            return;
        }

        AlarmManager alarmManager = getAlarmManager();
        if (alarmManager == null) {
            call.reject("AlarmManager is not available");
            return;
        }

        PendingIntent pi = buildPendingIntent(requestCode, epochMs);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    JSObject result = new JSObject();
                    result.put("scheduled", false);
                    result.put("reason", "cannot_schedule_exact_alarm");
                    call.resolve(result);
                    return;
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMs, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, epochMs, pi);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, epochMs, pi);
            }

            JSObject result = new JSObject();
            result.put("scheduled", true);
            result.put("epochMs", epochMs);
            result.put("requestCode", requestCode);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Failed to schedule exact alarm", ex);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer requestCode = call.getInt("requestCode", 1001);

        AlarmManager alarmManager = getAlarmManager();
        if (alarmManager == null) {
            call.reject("AlarmManager is not available");
            return;
        }

        PendingIntent pi = buildPendingIntent(requestCode, 0L);
        alarmManager.cancel(pi);
        pi.cancel();

        JSObject result = new JSObject();
        result.put("canceled", true);
        result.put("requestCode", requestCode);
        call.resolve(result);
    }

    @PluginMethod
    public void readAndClearFiredFlag(PluginCall call) {
        Context context = getContext();

        boolean fired = context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean("timer_alarm_fired", false);

        long firedAt = context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong("timer_alarm_fired_at", 0L);

        int requestCode = context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getInt("timer_alarm_request_code", -1);

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove("timer_alarm_fired")
            .remove("timer_alarm_fired_at")
            .remove("timer_alarm_request_code")
            .apply();

        JSObject result = new JSObject();
        result.put("fired", fired);
        result.put("firedAt", firedAt);
        result.put("requestCode", requestCode);
        call.resolve(result);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }

            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Failed to open exact alarm settings", ex);
        }
    }
}