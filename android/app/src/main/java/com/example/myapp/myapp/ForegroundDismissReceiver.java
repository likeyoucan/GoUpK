package com.example.myapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class ForegroundDismissReceiver extends BroadcastReceiver {
    public static final String ACTION_FG_DISMISSED = "com.example.myapp.FG_NOTIFICATION_DISMISSED";
    public static final String ACTION_BRIDGE_NOTIFICATION_DISMISSED = "com.example.myapp.FG_BRIDGE_NOTIFICATION_DISMISSED";

    private static final String PREFS = "fg_actions";
    private static final String KEY_NOTIFICATION_SUPPRESSED = "notification_suppressed";
    private static final String KEY_NOTIFICATION_SUPPRESSED_AT = "notification_suppressed_at";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (!ACTION_FG_DISMISSED.equals(intent.getAction())) return;

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_NOTIFICATION_SUPPRESSED, true)
            .putLong(KEY_NOTIFICATION_SUPPRESSED_AT, System.currentTimeMillis())
            .apply();

        Intent bridge = new Intent(ACTION_BRIDGE_NOTIFICATION_DISMISSED);
        bridge.setPackage(context.getPackageName());
        bridge.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB_MR1) {
            bridge.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
        }

        context.sendBroadcast(bridge);
    }
}