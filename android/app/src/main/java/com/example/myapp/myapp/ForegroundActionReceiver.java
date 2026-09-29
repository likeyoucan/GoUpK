package com.example.myapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ForegroundActionReceiver extends BroadcastReceiver {
    private static final String PREFS = "fg_actions";

    private static final String KEY_PENDING_BUTTON_ID = "pending_button_id";
    private static final String KEY_PENDING_EVENT_AT = "pending_event_at";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (!AppForegroundService.ACTION_BTN_TOGGLE.equals(action)) return;

        long now = System.currentTimeMillis();

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_PENDING_BUTTON_ID, 1)
            .putLong(KEY_PENDING_EVENT_AT, now)
            .apply();

        Intent bridge = new Intent(CustomForegroundServicePlugin.ACTION_BRIDGE_BUTTON_CLICKED);
        bridge.setPackage(context.getPackageName());
        bridge.putExtra("buttonId", 1);
        bridge.putExtra("eventAt", now);
        context.sendBroadcast(bridge);
    }
}