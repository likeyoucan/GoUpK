import { safeGetLS, safeSetLS, showToast } from "./utils.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

const ICON_OPTIONS = [
  {
    id: "default",
    nativeName: "default",
    image: "img/app_img.png",
    labelKey: "app_icon_default",
  },
  {
    id: "pro",
    nativeName: "pro",
    image: "img/app_img.png",
    labelKey: "app_icon_pro",
  },
    {
    id: "pro_1",
    nativeName: "pro_1",
    image: "img/app_img.png",
    labelKey: "app_icon_pro",
  },
      {
    id: "pro_123",
    nativeName: "123",
    image: "img/app_img.png",
    labelKey: "app_icon_pro",
  },
];

function getNativePlugin() {
  return window.Capacitor?.Plugins?.AppIconSwitcher || null;
}

async function applyNativeIcon(nativeName) {
  const plugin = getNativePlugin();
  if (!plugin?.setIconName) return;
  try {
    await plugin.setIconName({ name: nativeName });
  } catch (e) {
    console.warn("[app-icon] failed to set native icon", e);
  }
}

function tr(t, key, fallback) {
  const v = t(key);
  return v === key ? fallback : v;
}

export function initAppIconSelector({ t, appProManager }) {
  const container = document.getElementById("app-icon-options");
  if (!container) return;

  let current = safeGetLS(STORAGE_KEYS.APP_ICON_NAME) || "default";
  if (!ICON_OPTIONS.find((x) => x.id === current)) current = "default";

  const canUseIconFeature = () => appProManager.canUse("app_icon");

  const saveAndApply = async (id) => {
    const option = ICON_OPTIONS.find((x) => x.id === id) || ICON_OPTIONS[0];
    current = option.id;
    safeSetLS(STORAGE_KEYS.APP_ICON_NAME, current);
    await applyNativeIcon(option.nativeName);
  };

  const render = () => {
    container.replaceChildren();

    ICON_OPTIONS.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-icon-option";
      if (current === opt.id) btn.classList.add("is-selected");
      if (!canUseIconFeature() && opt.id !== "default")
        btn.classList.add("is-locked");

      btn.setAttribute("aria-label", tr(t, opt.labelKey, opt.id));

      const img = document.createElement("img");
      img.src = opt.image;
      img.alt = tr(t, opt.labelKey, opt.id);
      img.className = "app-icon-preview";
      img.decoding = "async";

      const label = document.createElement("span");
      label.className = "app-icon-label app-text-sec";
      label.textContent = tr(t, opt.labelKey, opt.id);

      btn.append(img, label);

      btn.addEventListener("click", async () => {
        if (!canUseIconFeature() && opt.id !== "default") {
          showToast(tr(t, "pro_required", "Feature available in Pro"));
          document.dispatchEvent(
            new CustomEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, {
              detail: { feature: "app_icon" },
            }),
          );
          return;
        }

        await saveAndApply(opt.id);
        render();
      });

      container.appendChild(btn);
    });
  };

  const syncByProState = async () => {
    // Если Pro недоступен, откатываем выбор к default.
    if (!canUseIconFeature() && current !== "default") {
      await saveAndApply("default");
    } else {
      const option =
        ICON_OPTIONS.find((x) => x.id === current) || ICON_OPTIONS[0];
      await applyNativeIcon(option.nativeName);
    }
    render();
  };

  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, () => {
    syncByProState();
  });

  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, () => {
    render();
  });

  syncByProState();
}
