package com.example.myapp;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class CustomForegroundServicePlugin extends Plugin {

    private BroadcastReceiver actionReceiver;

    @Override
    public void load() {
        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                if (!ForegroundActionReceiver.ACTION_BRIDGE_EVENT.equals(intent.getAction())) return;

                int buttonId = intent.getIntExtra(ForegroundActionReceiver.EXTRA_BUTTON_ID, 0);
                if (buttonId == 0) return;

                JSObject payload = new JSObject();
                payload.put("buttonId", buttonId);
                notifyListeners("buttonClicked", payload, true);
            }
        };

        IntentFilter filter = new IntentFilter(ForegroundActionReceiver.ACTION_BRIDGE_EVENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(actionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(actionReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (actionReceiver != null) {
            try {
                getContext().unregisterReceiver(actionReceiver);
            } catch (Exception ignored) {}
            actionReceiver = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        startOrUpdate(call);
    }

    @PluginMethod
    public void updateForegroundService(PluginCall call) {
        startOrUpdate(call);
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        Intent i = new Intent(getContext(), AppForegroundService.class);
        i.setAction(AppForegroundService.ACTION_STOP_SERVICE);
        startServiceCompat(i);

        JSObject out = new JSObject();
        out.put("stopped", true);
        call.resolve(out);
    }

    @PluginMethod
    public void moveToForeground(PluginCall call) {
        Intent open = new Intent(getContext(), MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        getContext().startActivity(open);
        call.resolve();
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject out = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            out.put("notifications", "granted");
        } else {
            PermissionState state = getPermissionState("notifications");
            out.put("notifications", state == PermissionState.GRANTED ? "granted" : "denied");
        }
        call.resolve(out);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject out = new JSObject();
            out.put("notifications", "granted");
            call.resolve(out);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionsCallback");
    }

    @PermissionCallback
    public void permissionsCallback(PluginCall call) {
        JSObject out = new JSObject();
        PermissionState state = getPermissionState("notifications");
        out.put("notifications", state == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(out);
    }

    @PluginMethod
    public void createNotificationChannel(PluginCall call) {
        String id = call.getString("id", AppForegroundService.CHANNEL_ID);
        String name = call.getString("name", "Stopwatch Pro");
        String description = call.getString("description", "Foreground timer controls");
        int importance = call.getInt("importance", NotificationManager.IMPORTANCE_LOW);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(id, name, importance);
                channel.setDescription(description);
                channel.setSound(null, null);
                channel.enableVibration(false);
                nm.createNotificationChannel(channel);
            }
        }

        JSObject out = new JSObject();
        out.put("created", true);
        out.put("id", id);
        call.resolve(out);
    }

    private void startOrUpdate(PluginCall call) {
        String title = call.getString("title", "Stopwatch");
        String body = call.getString("body", "00:00");
        String channelId = call.getString("notificationChannelId", AppForegroundService.CHANNEL_ID);

        String toggleText = "Pause";
        String stopText = "Stop";

        JSArray buttons = call.getArray("buttons");
        if (buttons != null && buttons.length() > 0) {
            try {
                JSONObject btn0 = buttons.getJSONObject(0);
                if (btn0 != null) toggleText = btn0.optString("title", toggleText);
                if (buttons.length() > 1) {
                    JSONObject btn1 = buttons.getJSONObject(1);
                    if (btn1 != null) stopText = btn1.optString("title", stopText);
                }
            } catch (Exception ignored) {}
        }

        Intent i = new Intent(getContext(), AppForegroundService.class);
        i.setAction(AppForegroundService.ACTION_START_OR_UPDATE);
        i.putExtra(AppForegroundService.EXTRA_TITLE, title);
        i.putExtra(AppForegroundService.EXTRA_BODY, body);
        i.putExtra(AppForegroundService.EXTRA_TOGGLE, toggleText);
        i.putExtra(AppForegroundService.EXTRA_STOP, stopText);
        i.putExtra(AppForegroundService.EXTRA_CHANNEL_ID, channelId);

        startServiceCompat(i);

        JSObject out = new JSObject();
        out.put("started", true);
        call.resolve(out);
    }

    private void startServiceCompat(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(getContext(), intent);
        } else {
            getContext().startService(intent);
        }
    }
}