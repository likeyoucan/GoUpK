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

    private void dispatchBridgeEvent(Context context, int buttonId) {
        Intent bridge = new Intent(ACTION_BRIDGE_EVENT);
        bridge.setPackage(context.getPackageName());
        bridge.putExtra(EXTRA_BUTTON_ID, buttonId);
        bridge.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);

        // On some devices this helps delivery when app was idle.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB_MR1) {
            bridge.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
        }

        context.sendBroadcast(bridge);
    }

    private void wakeAppIfNeeded(Context context, int buttonId) {
        if (isAppInForeground(context)) return;

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        open.putExtra(EXTRA_BUTTON_ID, buttonId);
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

        dispatchBridgeEvent(context, buttonId);
        wakeAppIfNeeded(context, buttonId);
    }
}