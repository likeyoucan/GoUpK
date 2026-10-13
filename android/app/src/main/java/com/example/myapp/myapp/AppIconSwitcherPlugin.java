package com.example.myapp;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppIconSwitcher")
public class AppIconSwitcherPlugin extends Plugin {

    private static final String DEFAULT_ALIAS = "MainActivityDefaultAlias";
    private static final String PRO_ALIAS = "MainActivityProAlias";

    private String mapToAlias(String name) {
        if (name == null) return DEFAULT_ALIAS;
        String n = name.trim().toLowerCase();

        if (n.equals("default")) return DEFAULT_ALIAS;

        // Все pro* варианты направляем на pro alias
        // (pro, pro_1 ... pro_9 и т.д.)
        if (n.startsWith("pro")) return PRO_ALIAS;

        return DEFAULT_ALIAS;
    }

    private void setAliasEnabled(Context context, String aliasSimpleName, boolean enabled) {
        String packageName = context.getPackageName();
        String fullName = packageName + "." + aliasSimpleName;

        ComponentName componentName = new ComponentName(packageName, fullName);
        PackageManager pm = context.getPackageManager();

        int state = enabled
            ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;

        pm.setComponentEnabledSetting(componentName, state, PackageManager.DONT_KILL_APP);
    }

    private String getCurrentAlias(Context context) {
        String packageName = context.getPackageName();
        PackageManager pm = context.getPackageManager();

        ComponentName def = new ComponentName(packageName, packageName + "." + DEFAULT_ALIAS);
        ComponentName pro = new ComponentName(packageName, packageName + "." + PRO_ALIAS);

        int defState = pm.getComponentEnabledSetting(def);
        int proState = pm.getComponentEnabledSetting(pro);

        boolean isProEnabled = proState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        boolean isDefEnabled = defState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            || defState == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT;

        if (isProEnabled) return "pro";
        if (isDefEnabled) return "default";
        return "default";
    }

    @PluginMethod
    public void setIconName(PluginCall call) {
        String name = call.getString("name", "default");
        Context context = getContext();

        try {
            String alias = mapToAlias(name);

            if (PRO_ALIAS.equals(alias)) {
                setAliasEnabled(context, DEFAULT_ALIAS, false);
                setAliasEnabled(context, PRO_ALIAS, true);
            } else {
                setAliasEnabled(context, PRO_ALIAS, false);
                setAliasEnabled(context, DEFAULT_ALIAS, true);
            }

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("name", name);
            result.put("applied", PRO_ALIAS.equals(alias) ? "pro" : "default");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to set icon", e);
        }
    }

    @PluginMethod
    public void getIconName(PluginCall call) {
        try {
            String current = getCurrentAlias(getContext());
            JSObject result = new JSObject();
            result.put("name", current);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get icon name", e);
        }
    }
}