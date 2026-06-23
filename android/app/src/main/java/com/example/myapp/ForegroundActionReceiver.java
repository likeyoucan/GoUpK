package com.example.myapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ForegroundActionReceiver extends BroadcastReceiver {
    public static final String ACTION_BRIDGE_EVENT = "com.example.myapp.FG_BRIDGE_EVENT";
    public static final String EXTRA_BUTTON_ID = "buttonId";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        int buttonId = 0;
        String action = intent.getAction();

        if (AppForegroundService.ACTION_BTN_TOGGLE.equals(action)) {
            buttonId = 1;
        }

        if (buttonId == 0) return;

        Intent bridge = new Intent(ACTION_BRIDGE_EVENT);
        bridge.setPackage(context.getPackageName());
        bridge.putExtra(EXTRA_BUTTON_ID, buttonId);
        bridge.addFlags(Intent.FLAG_RECEIVER_FOREGROUND); // более приоритетная доставка
        context.sendBroadcast(bridge);
    }
}