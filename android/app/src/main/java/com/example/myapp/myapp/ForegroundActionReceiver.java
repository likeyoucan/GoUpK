package com.example.myapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

public class ForegroundActionReceiver extends BroadcastReceiver {
    private static final String PREFS = "fg_actions";

    private static final String KEY_PENDING_BUTTON_ID = "pending_button_id";
    private static final String KEY_PENDING_EVENT_AT = "pending_event_at";
    private static final String KEY_LAST_TOGGLE_AT = "last_toggle_at";

    // Very small debounce: protects from accidental double-dispatch,
    // while keeping rapid user taps responsive.
    private static final long TOGGLE_DEBOUNCE_MS = 60L;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (!AppForegroundService.ACTION_BTN_TOGGLE.equals(action)) return;

        long now = System.currentTimeMillis();

        long lastToggleAt = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getLong(KEY_LAST_TOGGLE_AT, 0L);

        if (now - lastToggleAt < TOGGLE_DEBOUNCE_MS) {
            return;
        }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_TOGGLE_AT, now)
            .putInt(KEY_PENDING_BUTTON_ID, 1)
            .putLong(KEY_PENDING_EVENT_AT, now)
            .apply();

        // Native-first toggle so notification controls remain responsive
        // even when WebView/JS bridge is paused.
        ForegroundStateStore store = new ForegroundStateStore(context);
        ForegroundStateStore.RuntimeState toggled = store.toggle();

        Intent serviceIntent = new Intent(context, AppForegroundService.class);
        serviceIntent.setAction(AppForegroundService.ACTION_START_OR_UPDATE);
        serviceIntent.putExtra(AppForegroundService.EXTRA_TITLE, toggled.notifTitle);
        serviceIntent.putExtra(AppForegroundService.EXTRA_BODY, toggled.notifBody);
        serviceIntent.putExtra(AppForegroundService.EXTRA_TOGGLE, toggled.toggleTitle);
        serviceIntent.putExtra(AppForegroundService.EXTRA_CHANNEL_ID, toggled.channelId);
        serviceIntent.putExtra(AppForegroundService.EXTRA_IS_DARK_THEME, toggled.isDarkTheme);
        serviceIntent.putExtra(AppForegroundService.EXTRA_ACCENT_COLOR, toggled.accentColor);
        serviceIntent.putExtra(AppForegroundService.EXTRA_ON_ACCENT_COLOR, toggled.onAccentColor);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        // Keep JS bridge event for UI/state sync in web layer.
        Intent bridge = new Intent(CustomForegroundServicePlugin.ACTION_BRIDGE_BUTTON_CLICKED);
        bridge.setPackage(context.getPackageName());
        bridge.putExtra("buttonId", 1);
        bridge.putExtra("eventAt", now);
        context.sendBroadcast(bridge);
    }
}