package com.example.myapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

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

        // Гарантия доставки: даже если live-событие до JS не дошло,
        // pending action будет прочитан позже через readAndClearPendingButton().
        persistPendingAction(context, buttonId, eventAt);

        // Отправляем live bridge-событие в плагин/JS.
        dispatchBridgeEvent(context, buttonId, eventAt);

        // ВАЖНО: не поднимаем Activity на каждую кнопку Play/Pause,
        // это добавляет заметную задержку и лишние lifecycle-переходы.
        // UI поднимается по tap на нотификацию (notificationTapped/moveToForeground).
    }
}