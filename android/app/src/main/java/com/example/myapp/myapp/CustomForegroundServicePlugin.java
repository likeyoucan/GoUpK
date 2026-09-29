package com.example.myapp;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

@CapacitorPlugin(
    name = "CustomForegroundService",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class CustomForegroundServicePlugin extends Plugin {
    public static final String ACTION_BRIDGE_BUTTON_CLICKED = "com.example.myapp.FG_BRIDGE_BUTTON_CLICKED";
    public static final String ACTION_BRIDGE_NOTIFICATION_DISMISSED = "com.example.myapp.FG_BRIDGE_NOTIFICATION_DISMISSED";
    public static final String ACTION_BRIDGE_NOTIFICATION_TAPPED = "com.example.myapp.FG_BRIDGE_NOTIFICATION_TAPPED";

    private static final String ACTION_PREFS = "fg_actions";
    private static final String KEY_PENDING_BUTTON_ID = "pending_button_id";
    private static final String KEY_PENDING_EVENT_AT = "pending_event_at";
    private static final String KEY_NOTIFICATION_SUPPRESSED = "notification_suppressed";

    private BroadcastReceiver buttonReceiver;
    private BroadcastReceiver dismissedReceiver;
    private BroadcastReceiver tappedReceiver;

    @Override
    public void load() {
        super.load();
        bindBridgeReceivers();
    }

    @Override
    protected void handleOnDestroy() {
        unbindBridgeReceivers();
        super.handleOnDestroy();
    }

    private void bindBridgeReceivers() {
        if (buttonReceiver == null) {
            buttonReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    JSObject data = new JSObject();
                    data.put("buttonId", intent.getIntExtra("buttonId", 1));
                    data.put("eventAt", intent.getLongExtra("eventAt", System.currentTimeMillis()));
                    notifyListeners("buttonClicked", data, true);
                }
            };

            ContextCompat.registerReceiver(
                getContext(),
                buttonReceiver,
                new IntentFilter(ACTION_BRIDGE_BUTTON_CLICKED),
                ContextCompat.RECEIVER_NOT_EXPORTED
            );
        }

        if (dismissedReceiver == null) {
            dismissedReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    notifyListeners("notificationDismissed", new JSObject(), true);
                }
            };

            ContextCompat.registerReceiver(
                getContext(),
                dismissedReceiver,
                new IntentFilter(ACTION_BRIDGE_NOTIFICATION_DISMISSED),
                ContextCompat.RECEIVER_NOT_EXPORTED
            );
        }

        if (tappedReceiver == null) {
            tappedReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    notifyListeners("notificationTapped", new JSObject(), true);
                }
            };

            ContextCompat.registerReceiver(
                getContext(),
                tappedReceiver,
                new IntentFilter(ACTION_BRIDGE_NOTIFICATION_TAPPED),
                ContextCompat.RECEIVER_NOT_EXPORTED
            );
        }
    }

    private void unbindBridgeReceivers() {
        try {
            if (buttonReceiver != null) {
                getContext().unregisterReceiver(buttonReceiver);
                buttonReceiver = null;
            }
        } catch (Exception ignored) {}

        try {
            if (dismissedReceiver != null) {
                getContext().unregisterReceiver(dismissedReceiver);
                dismissedReceiver = null;
            }
        } catch (Exception ignored) {}

        try {
            if (tappedReceiver != null) {
                getContext().unregisterReceiver(tappedReceiver);
                tappedReceiver = null;
            }
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        startOrUpdateService(call);
    }

    @PluginMethod
    public void updateForegroundService(PluginCall call) {
        startOrUpdateService(call);
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        Intent intent = new Intent(getContext(), AppForegroundService.class);
        intent.setAction(AppForegroundService.ACTION_STOP_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(getContext(), intent);
        } else {
            getContext().startService(intent);
        }

        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        startForegroundService(call);
    }

    @PluginMethod
    public void update(PluginCall call) {
        updateForegroundService(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopForegroundService(call);
    }

    private void startOrUpdateService(PluginCall call) {
        String title = call.getString("title", "Stopwatch");
        String body = call.getString("body", "00:00");
        String channelId = call.getString("notificationChannelId", AppForegroundService.CHANNEL_ID);
        boolean isDarkTheme = call.getBoolean("isDarkTheme", false);
        String accentColor = call.getString("color", "#3399ff");
        String onAccentColor = call.getString("buttonTextColor", "#ffffff");

        String toggleText = extractToggleTitle(call.getArray("buttons"));

        JSObject runtimeState = call.getObject("runtimeState");
        if (runtimeState != null) {
            new ForegroundStateStore(getContext()).updateFromJson(runtimeState);
        }

        getContext().getSharedPreferences(ACTION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_NOTIFICATION_SUPPRESSED, false)
            .apply();

        Intent intent = new Intent(getContext(), AppForegroundService.class);
        intent.setAction(AppForegroundService.ACTION_START_OR_UPDATE);
        intent.putExtra(AppForegroundService.EXTRA_TITLE, title);
        intent.putExtra(AppForegroundService.EXTRA_BODY, body);
        intent.putExtra(AppForegroundService.EXTRA_TOGGLE, toggleText);
        intent.putExtra(AppForegroundService.EXTRA_CHANNEL_ID, channelId);
        intent.putExtra(AppForegroundService.EXTRA_IS_DARK_THEME, isDarkTheme);
        intent.putExtra(AppForegroundService.EXTRA_ACCENT_COLOR, accentColor);
        intent.putExtra(AppForegroundService.EXTRA_ON_ACCENT_COLOR, onAccentColor);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(getContext(), intent);
        } else {
            getContext().startService(intent);
        }

        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    private String extractToggleTitle(JSArray buttons) {
        if (buttons == null || buttons.length() == 0) return "▶";
        try {
            Object item = buttons.get(0);
            if (item instanceof JSONObject) {
                String title = ((JSONObject) item).optString("title", "▶");
                return title == null || title.trim().isEmpty() ? "▶" : title;
            }
        } catch (Exception ignored) {}
        return "▶";
    }

    @PluginMethod
    public void setRuntimeState(PluginCall call) {
        JSObject runtimeState = call.getObject("runtimeState");
        if (runtimeState != null) {
            new ForegroundStateStore(getContext()).updateFromJson(runtimeState);
        }

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getRuntimeState(PluginCall call) {
        ForegroundStateStore.RuntimeState s = new ForegroundStateStore(getContext()).read();

        JSObject result = new JSObject();
        result.put("mode", s.mode);
        result.put("running", s.running);
        result.put("updatedAt", s.updatedAt);
        result.put("swElapsedMs", s.swElapsedMs);
        result.put("tmRemainingMs", s.tmRemainingMs);
        result.put("tmTotalMs", s.tmTotalMs);
        result.put("tbStatus", s.tbStatus);
        result.put("tbRound", s.tbRound);
        result.put("tbRounds", s.tbRounds);
        result.put("tbPhaseDuration", s.tbPhaseDuration);
        result.put("tbWorkoutName", s.tbWorkoutName);
        result.put("tbRemainingMs", s.tbRemainingMs);
        result.put("notifTitle", s.notifTitle);
        result.put("notifBody", s.notifBody);
        result.put("channelId", s.channelId);
        result.put("isDarkTheme", s.isDarkTheme);
        result.put("accentColor", s.accentColor);
        result.put("onAccentColor", s.onAccentColor);

        call.resolve(result);
    }

    @PluginMethod
    public void readAndClearPendingButton(PluginCall call) {
        Context context = getContext();

        int id = context.getSharedPreferences(ACTION_PREFS, Context.MODE_PRIVATE)
            .getInt(KEY_PENDING_BUTTON_ID, -1);

        long eventAt = context.getSharedPreferences(ACTION_PREFS, Context.MODE_PRIVATE)
            .getLong(KEY_PENDING_EVENT_AT, 0L);

        context.getSharedPreferences(ACTION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_PENDING_BUTTON_ID)
            .remove(KEY_PENDING_EVENT_AT)
            .apply();

        JSObject result = new JSObject();
        result.put("hasPending", id > 0 && eventAt > 0);
        result.put("buttonId", id > 0 ? id : 0);
        result.put("eventAt", eventAt);
        call.resolve(result);
    }

    @PluginMethod
    public void isNotificationSuppressed(PluginCall call) {
        boolean suppressed = getContext()
            .getSharedPreferences(ACTION_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_NOTIFICATION_SUPPRESSED, false);

        JSObject result = new JSObject();
        result.put("suppressed", suppressed);
        call.resolve(result);
    }

    @PluginMethod
    public void clearNotificationSuppressed(PluginCall call) {
        getContext()
            .getSharedPreferences(ACTION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_NOTIFICATION_SUPPRESSED, false)
            .apply();

        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    @PluginMethod
    public void moveToForeground(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            Intent intent = new Intent(getContext(), MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            getContext().startActivity(intent);
        } else {
            Intent intent = new Intent(activity, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            activity.startActivity(intent);
        }

        JSObject result = new JSObject();
        result.put("moved", true);
        call.resolve(result);
    }

    @PluginMethod
    public void createNotificationChannel(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(new JSObject());
            return;
        }

        String id = call.getString("id", AppForegroundService.CHANNEL_ID);
        String name = call.getString("name", "Stopwatch Pro");
        String description = call.getString("description", "Foreground timer controls");
        int importance = call.getInt("importance", NotificationManager.IMPORTANCE_LOW);

        NotificationManager nm = getContext().getSystemService(NotificationManager.class);
        if (nm != null) {
            NotificationChannel channel = new NotificationChannel(id, name, importance);
            channel.setDescription(description);
            channel.setSound(null, null);
            channel.enableVibration(false);
            nm.createNotificationChannel(channel);
        }

        JSObject result = new JSObject();
        result.put("created", true);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteNotificationChannel(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(new JSObject());
            return;
        }

        String id = call.getString("id", AppForegroundService.CHANNEL_ID);
        NotificationManager nm = getContext().getSystemService(NotificationManager.class);
        if (nm != null) {
            try {
                nm.deleteNotificationChannel(id);
            } catch (Exception ignored) {}
        }

        JSObject result = new JSObject();
        result.put("deleted", true);
        call.resolve(result);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            result.put("notifications", "granted");
            call.resolve(result);
            return;
        }

        PermissionState state = getPermissionState("notifications");
        result.put("notifications", state == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject result = new JSObject();
            result.put("notifications", "granted");
            call.resolve(result);
            return;
        }

        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("notifications", "granted");
            call.resolve(result);
            return;
        }

        requestPermissionForAlias("notifications", call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put(
            "notifications",
            getPermissionState("notifications") == PermissionState.GRANTED ? "granted" : "denied"
        );
        call.resolve(result);
    }
}