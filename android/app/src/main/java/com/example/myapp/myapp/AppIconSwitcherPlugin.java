package com.example.myapp;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSArray;
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

        if ("default".equals(n)) return DEFAULT_ALIAS;

        // Map all pro* variants to one pro alias.
        if (n.startsWith("pro")) return PRO_ALIAS;

        return DEFAULT_ALIAS;
    }

    private ComponentName buildAliasComponent(Context context, String aliasSimpleName) {
        String packageName = context.getPackageName();
        String fullName = packageName + "." + aliasSimpleName;
        return new ComponentName(packageName, fullName);
    }

    private boolean isAliasDeclared(Context context, String aliasSimpleName) {
        try {
            ComponentName componentName = buildAliasComponent(context, aliasSimpleName);
            context.getPackageManager().getActivityInfo(componentName, 0);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void setAliasEnabled(Context context, String aliasSimpleName, boolean enabled) {
        ComponentName componentName = buildAliasComponent(context, aliasSimpleName);
        PackageManager pm = context.getPackageManager();

        int state = enabled
            ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;

        pm.setComponentEnabledSetting(componentName, state, PackageManager.DONT_KILL_APP);
    }

    private String getCurrentAlias(Context context) {
        boolean hasDefault = isAliasDeclared(context, DEFAULT_ALIAS);
        boolean hasPro = isAliasDeclared(context, PRO_ALIAS);

        if (!hasDefault) {
            // Broken manifest state: keep a safe semantic fallback.
            return "default";
        }

        PackageManager pm = context.getPackageManager();

        ComponentName def = buildAliasComponent(context, DEFAULT_ALIAS);
        int defState = pm.getComponentEnabledSetting(def);

        boolean isDefEnabled = defState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            || defState == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT;

        if (hasPro) {
            ComponentName pro = buildAliasComponent(context, PRO_ALIAS);
            int proState = pm.getComponentEnabledSetting(pro);
            boolean isProEnabled = proState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
            if (isProEnabled) return "pro";
        }

        if (isDefEnabled) return "default";
        return "default";
    }

    @PluginMethod
    public void setIconName(PluginCall call) {
        String requestedName = call.getString("name", "default");
        Context context = getContext();

        try {
            boolean hasDefault = isAliasDeclared(context, DEFAULT_ALIAS);
            boolean hasPro = isAliasDeclared(context, PRO_ALIAS);

            if (!hasDefault) {
                call.reject("Default launcher alias is not declared in AndroidManifest.xml");
                return;
            }

            String mappedAlias = mapToAlias(requestedName);

            // If pro alias is absent in this build, force default without crashing.
            if (PRO_ALIAS.equals(mappedAlias) && !hasPro) {
                mappedAlias = DEFAULT_ALIAS;
            }

            if (PRO_ALIAS.equals(mappedAlias)) {
                // Safe order: enable target first, then disable the other alias.
                setAliasEnabled(context, PRO_ALIAS, true);
                setAliasEnabled(context, DEFAULT_ALIAS, false);
            } else {
                setAliasEnabled(context, DEFAULT_ALIAS, true);
                if (hasPro) {
                    setAliasEnabled(context, PRO_ALIAS, false);
                }
            }

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("requested", requestedName);
            result.put("applied", PRO_ALIAS.equals(mappedAlias) ? "pro" : "default");
            result.put("hasProAlias", hasPro);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Failed to set icon: security exception", e);
        } catch (IllegalArgumentException e) {
            call.reject("Failed to set icon: invalid component alias", e);
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

    @PluginMethod
    public void getAvailableIcons(PluginCall call) {
        try {
            Context context = getContext();
            boolean hasDefault = isAliasDeclared(context, DEFAULT_ALIAS);
            boolean hasPro = isAliasDeclared(context, PRO_ALIAS);

            JSArray names = new JSArray();
            if (hasDefault) names.put("default");
            if (hasPro) names.put("pro");

            JSObject result = new JSObject();
            result.put("names", names);
            result.put("hasDefaultAlias", hasDefault);
            result.put("hasProAlias", hasPro);

            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get available icons", e);
        }
    }
}