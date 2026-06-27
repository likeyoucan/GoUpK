package com.example.myapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

public class ForegroundActionReceiver extends BroadcastReceiver {
    public static final String ACTION_BRIDGE_EVENT = "com.example.myapp.FG_BRIDGE_EVENT";
    public static final String EXTRA_BUTTON_ID = "buttonId";
    public static final String EXTRA_EVENT_AT = "eventAt";

    private static final String PREFS = "fg_actions";
    private static final String KEY_PENDING_BUTTON_ID = "pending_button_id";
    private static final String KEY_PENDING_AT = "pending_at";

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

    private void startOrUpdateServiceFromState(Context context, ForegroundStateStore.RuntimeState s) {
        Intent i = new Intent(context, AppForegroundService.class);
        i.setAction(AppForegroundService.ACTION_START_OR_UPDATE);
        i.putExtra(AppForegroundService.EXTRA_TITLE, s.notifTitle);
        i.putExtra(AppForegroundService.EXTRA_BODY, s.notifBody);
        i.putExtra(AppForegroundService.EXTRA_TOGGLE, s.toggleTitle);
        i.putExtra(AppForegroundService.EXTRA_CHANNEL_ID, s.channelId);
        i.putExtra(AppForegroundService.EXTRA_IS_DARK_THEME, s.isDarkTheme);
        i.putExtra(AppForegroundService.EXTRA_ACCENT_COLOR, s.accentColor);
        i.putExtra(AppForegroundService.EXTRA_ON_ACCENT_COLOR, s.onAccentColor);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, i);
        } else {
            context.startService(i);
        }
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

        // 1) Гарантированная доставка в JS через pending fallback
        persistPendingAction(context, buttonId, eventAt);

        // 2) Моментальный нативный toggle (без ожидания WebView)
        ForegroundStateStore store = new ForegroundStateStore(context);
        ForegroundStateStore.RuntimeState stateAfterToggle = store.toggle();

        // 3) Моментально обновляем шторку из native-state
        startOrUpdateServiceFromState(context, stateAfterToggle);

        // 4) Дополнительно отправляем live-событие в bridge
        dispatchBridgeEvent(context, buttonId, eventAt);

        // ВАЖНО: Activity не поднимаем — это добавляет заметный лаг.
        // Открытие приложения остается по тапу на notificationTapped.
    }
}