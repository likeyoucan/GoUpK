package com.example.myapp;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.List;

public class ForegroundActionReceiver extends BroadcastReceiver {
    public static final String ACTION_BRIDGE_EVENT = "com.example.myapp.FG_BRIDGE_EVENT";
    public static final String EXTRA_BUTTON_ID = "buttonId";
    public static final String EXTRA_EVENT_AT = "eventAt";

    private static final String PREFS = "fg_actions";
    private static final String KEY_PENDING_BUTTON_ID = "pending_button_id";
    private static final String KEY_PENDING_AT = "pending_at";

    private boolean isAppInForeground(Context context) {
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;

        List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
        if (processes == null) return false;

        String pkg = context.getPackageName();
        for (ActivityManager.RunningAppProcessInfo p : processes) {
            if (p == null || p.processName == null) continue;
            if (!pkg.equals(p.processName)) continue;

            return p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                || p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
        }
        return false;
    }

    private void persistPendingAction(Context context, int buttonId, long eventAt) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_PENDING_BUTTON_ID, buttonId)
            .putLong(KEY_PENDING_AT, eventAt)
            .apply();
    }

    private void dispatchBridgeEvent(Context context, int buttonId, long eventAt) {
        Intent bridge = new Intent(ACTION_BRIDGE_EVENT);
        bridge.setPackage(context.getPackageName());
        bridge.putExtra(EXTRA_BUTTON_ID, buttonId);
        bridge.putExtra(EXTRA_EVENT_AT, eventAt);
        bridge.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB_MR1) {
            bridge.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
        }

        context.sendBroadcast(bridge);
    }

    private void wakeAppIfNeeded(Context context, int buttonId, long eventAt) {
        if (isAppInForeground(context)) return;

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        open.putExtra(EXTRA_BUTTON_ID, buttonId);
        open.putExtra(EXTRA_EVENT_AT, eventAt);
        context.startActivity(open);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        int buttonId = 0;
        String action = intent.getAction();

        if (AppForegroundService.ACTION_BTN_TOGGLE.equals(action)) {
            buttonId = 1;
        }

        if (buttonId == 0) return;

        long eventAt = System.currentTimeMillis();

        // Гарантия: даже если bridge-событие потеряется, JS потом заберет pending action.
        persistPendingAction(context, buttonId, eventAt);

        dispatchBridgeEvent(context, buttonId, eventAt);
        wakeAppIfNeeded(context, buttonId, eventAt);
    }
}