// Файл: www/js/color-manager.js

import {
  $,
  safeGetLS,
  safeSetLS,
  showToast,
  createSVGIcon,
  getLuminance,
  hexToRGB,
  getCssVariable,
  normalizeHexColor,
} from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { appProManager } from "./app-pro.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

import {
  MAX_CUSTOM_COLORS,
  normalizeColor,
  loadCustomColors,
  persistCustomColors,
  removeColorFromList,
  buildBlocklist,
} from "./color/color-data.js?v=VERSION";

import {
  populateColorSection,
  addColorToDOM,
  updateAddButtonColor,
  updateSelectionUI,
} from "./color/color-ui.js?v=VERSION";

const normalize = (c) => normalizeColor(normalizeHexColor, c);

function showProMessage(feature = "custom_colors") {
  showToast(
    t("pro_required") === "pro_required"
      ? "Feature available in Pro"
      : t("pro_required"),
  );
  document.dispatchEvent(
    new CustomEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, {
      detail: { feature },
    }),
  );
}

function captureRects(container) {
  const map = new Map();
  if (!container) return map;

  container
    .querySelectorAll(".color-swatch-wrapper, .color-picker-wrapper")
    .forEach((el) => {
      map.set(el, el.getBoundingClientRect());
    });

  return map;
}

function clearPickerFocusVisual(pickerWrapper, picker) {
  if (!pickerWrapper) return;

  const ringClasses = [
    "ring-2",
    "ring-[var(--primary-color)]",
    "ring-offset-2",
    "ring-offset-surface",
  ];

  const blurOnce = () => {
    try {
      if (picker && typeof picker.blur === "function") picker.blur();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur?.();
      }
    } catch {}
  };

  blurOnce();
  pickerWrapper.classList.remove(...ringClasses);
  pickerWrapper.classList.add("picker-focus-suppressed");

  requestAnimationFrame(() => {
    blurOnce();
    pickerWrapper.classList.remove(...ringClasses);
  });

  setTimeout(() => {
    blurOnce();
    pickerWrapper.classList.remove(...ringClasses);
    pickerWrapper.classList.remove("picker-focus-suppressed");
  }, 180);

  setTimeout(() => {
    blurOnce();
    pickerWrapper.classList.remove(...ringClasses);
  }, 450);
}

function animateLayoutShift(
  container,
  beforeMap,
  { duration = 380, springTarget = null } = {},
) {
  if (!container) return;

  const nodes = [
    ...container.querySelectorAll(
      ".color-swatch-wrapper, .color-picker-wrapper",
    ),
  ];

  const moved = nodes
    .map((el) => {
      const before = beforeMap.get(el);
      if (!before) return null;

      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
      return { el, dx, dy };
    })
    .filter(Boolean);

  if (!moved.length) return;

  let resolvedSpring = null;
  if (springTarget) {
    const found = moved.find((m) => m.el === springTarget);
    if (found) resolvedSpring = found.el;
  }
  if (!resolvedSpring) resolvedSpring = moved[0].el;

  moved.forEach(({ el, dx, dy }) => {
    if (el === resolvedSpring) {
      const push = dx >= 0 ? -5.5 : 5.5;
      const rebound = -push * 0.34;
      const settle = push * 0.1;

      el.style.transformOrigin = "left center";

      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1,1)` },
          {
            transform: `translate(${push}px, 0) scale(1.05, 0.95)`,
            offset: 0.58,
          },
          {
            transform: `translate(${rebound}px, 0) scale(0.97, 1.03)`,
            offset: 0.82,
          },
          {
            transform: `translate(${settle}px, 0) scale(1.01, 0.99)`,
            offset: 0.93,
          },
          { transform: "translate(0,0) scale(1,1)" },
        ],
        {
          duration: 620,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
      return;
    }

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1,1)` },
        { transform: "translate(-0.9px, 0) scale(1.01, 0.99)", offset: 0.74 },
        { transform: "translate(0,0) scale(1,1)" },
      ],
      {
        duration,
        easing: "cubic-bezier(0.22, 0.94, 0.26, 1)",
      },
    );
  });
}

function animateNewSwatch(el) {
  if (!el) return;

  el.style.transformOrigin = "center center";

  el.animate(
    [
      { opacity: 0, transform: "translateY(3px) scale(0.95)" },
      { opacity: 1, transform: "translateY(-1px) scale(1.02)", offset: 0.65 },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    {
      duration: 520,
      easing: "cubic-bezier(0.22, 0.95, 0.25, 1)",
    },
  );
}

function animateDeleteSwatch(wrapper) {
  if (!wrapper) return Promise.resolve();

  return wrapper.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0.94, transform: "scale(0.97)", offset: 0.6 },
      { opacity: 0, transform: "scale(0.9)" },
    ],
    {
      duration: 320,
      easing: "cubic-bezier(0.22, 0.92, 0.28, 1)",
      fill: "forwards",
    },
  ).finished;
}

export const colorManager = {
  customAccentColors: [],
  customBgColors: [],
  activeActionTarget: null,

  standardAccentColors: [
    "default",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
    "#f97316",
    "#ef4444",
    "#6366f1",
    "#e11d48",
  ],
  standardBgColors: [
    "default",
    "#60a5fa",
    "#c084fc",
    "#f472b6",
    "#34d399",
    "#facc15",
    "#f87171",
    "#2dd4bf",
  ],

  init() {
    this.loadColors();
    this.populateColorSection("accent");
    this.populateColorSection("bg");
    this._bindEvents();
  },

  loadColors() {
    const data = loadCustomColors({ safeGetLS });
    this.customAccentColors = data.accent;
    this.customBgColors = data.bg;
  },

  _bindEvents() {
    this._bindContainerEvents("accent-colors-container", "accent");
    this._bindContainerEvents("bg-colors-container", "bg");

    const bindPicker = (type) => {
      const picker = $(
        type === "accent" ? "customColorInput" : "customBgInput",
      );
      if (!picker) return;

      const blockIfNoPro = (e) => {
        if (appProManager.canUse("custom_colors")) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();

        showProMessage("custom_colors");
        return false;
      };

      picker.addEventListener("pointerdown", blockIfNoPro, { capture: true });
      picker.addEventListener("mousedown", blockIfNoPro, { capture: true });
      picker.addEventListener("touchstart", blockIfNoPro, {
        capture: true,
        passive: false,
      });
      picker.addEventListener("click", blockIfNoPro, { capture: true });

      picker.addEventListener("change", (e) => {
        if (!appProManager.canUse("custom_colors")) return;

        document.dispatchEvent(
          new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
            detail: { type, color: e.target.value, fromPicker: true },
          }),
        );
      });

      picker.addEventListener("input", (e) => {
        if (!appProManager.canUse("custom_colors")) return;

        const pickerWrapper = picker.closest(".color-picker-wrapper");
        if (this.activeActionTarget === pickerWrapper) {
          const actionBtn = pickerWrapper.querySelector(
            '.color-action-btn[data-action="add"]',
          );
          if (actionBtn) {
            updateAddButtonColor({
              button: actionBtn,
              color: e.target.value,
              hexToRGB,
              getLuminance,
            });
          }
        }
      });
    };

    bindPicker("accent");
    bindPicker("bg");
  },

  _bindContainerEvents(containerId, type) {
    const container = $(containerId);
    if (!container) return;

    container.addEventListener("click", (e) => this._handleClick(e, type));
  },

  _handleClick(event, type) {
    const swatchWrapper = event.target.closest(".color-swatch-wrapper");
    const pickerWrapper = event.target.closest(".color-picker-wrapper");
    const actionBtn = event.target.closest(".color-action-btn");

    if (actionBtn) {
      event.stopPropagation();

      if (actionBtn.dataset.action === "add") {
        if (!appProManager.canUse("custom_colors")) {
          showProMessage("custom_colors");
          this._hideActionButton();
          return;
        }
        this.addCustomColor(type);
      } else if (actionBtn.dataset.action === "delete") {
        if (!appProManager.canUse("custom_colors")) {
          showProMessage("custom_colors");
          this._hideActionButton();
          return;
        }
        this._deleteColor(actionBtn.dataset.color, type);
      }
      return;
    }

    if (pickerWrapper) {
      if (!appProManager.canUse("custom_colors")) {
        showProMessage("custom_colors");
        return;
      }

      if (this.activeActionTarget === pickerWrapper) this._hideActionButton();
      else this._showActionButton(pickerWrapper, "add");
      return;
    }

    if (
      this.activeActionTarget &&
      !this.activeActionTarget.contains(event.target)
    ) {
      this._hideActionButton();
    }

    if (!swatchWrapper) return;

    const isCustom = swatchWrapper.dataset.custom === "true";
    if (isCustom && !appProManager.canUse("custom_colors")) {
      showProMessage("custom_colors");
      return;
    }

    if (this.activeActionTarget === swatchWrapper) {
      this._hideActionButton();
      return;
    }

    const color = swatchWrapper.dataset.color;
    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
        detail: { type, color, fromPicker: false },
      }),
    );

    if (isCustom) {
      this._showActionButton(swatchWrapper, "delete");
    }
  },

  _showActionButton(targetWrapper, action) {
    if (this.activeActionTarget && this.activeActionTarget !== targetWrapper) {
      this._hideActionButton();
    }

    sm.vibrate(30, "medium");
    this.activeActionTarget = targetWrapper;

    const isAdd = action === "add";
    const color = isAdd
      ? targetWrapper.querySelector('input[type="color"]').value
      : targetWrapper.dataset.color;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = action;
    btn.className = isAdd
      ? "color-action-btn w-full h-full inset-0 m-auto flex items-center justify-center rounded-full shadow-lg focus:outline-none custom-focus active:scale-90 transition-transform"
      : "color-action-btn flex items-center justify-center rounded-full shadow-lg focus:outline-none custom-focus active:scale-90 transition-transform";

    if (isAdd) {
      btn.setAttribute("aria-label", t("add_color"));
      updateAddButtonColor({ button: btn, color, hexToRGB, getLuminance });
      btn.append(createSVGIcon("M12 4.5v15m7.5-7.5h-15", ["w-5", "h-5"]));
    } else {
      btn.setAttribute("aria-label", `${t("delete")} ${color}`);
      btn.classList.add("bg-red-500", "text-white");
      btn.dataset.color = color;
      btn.append(createSVGIcon("M6 18L18 6M6 6l12 12", ["w-5", "h-5"]));
    }

    targetWrapper.append(btn);
  },

  _hideActionButton() {
    if (!this.activeActionTarget) return;

    const btn = this.activeActionTarget.querySelector(".color-action-btn");
    if (btn) {
      btn.classList.add("is-hiding");
      btn.addEventListener("animationend", () => btn.remove(), { once: true });
    }

    this.activeActionTarget = null;
  },

  addCustomColor(type) {
    const allowed = appProManager.requirePro("custom_colors", () =>
      showProMessage("custom_colors"),
    );
    if (!allowed) return;

    const isAccent = type === "accent";
    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;

    if (customColors.length >= MAX_CUSTOM_COLORS) {
      showToast(t(isAccent ? "accent_limit_msg" : "bg_limit_msg"));
      return;
    }

    const picker = $(isAccent ? "customColorInput" : "customBgInput");
    const newColor = normalize(picker.value);

    const blocklist = buildBlocklist({
      isAccent,
      standardAccentColors: this.standardAccentColors,
      standardBgColors: this.standardBgColors,
      customAccentColors: this.customAccentColors,
      customBgColors: this.customBgColors,
      normalizeHexColor,
    });

    if (blocklist.includes(newColor)) {
      this._hideActionButton();
      showToast(t("color_already_exists"));
      return;
    }

    const currentTheme = themeManager.getCurrentTheme();
    const cssVarName = isAccent
      ? `--default-accent-${currentTheme}`
      : `--default-bg-${currentTheme}`;
    const activeDefaultColor = normalize(getCssVariable(cssVarName));

    if (newColor === activeDefaultColor) {
      this._hideActionButton();
      showToast(t("color_already_exists"));
      return;
    }

    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const pickerWrapper = picker?.closest(".color-picker-wrapper");

    clearPickerFocusVisual(pickerWrapper, picker);

    const before = captureRects(container);

    this._hideActionButton();
    clearPickerFocusVisual(pickerWrapper, picker);
    sm.vibrate(40, "medium");

    customColors.push(newColor);
    persistCustomColors({ safeSetLS }, type, customColors);

    addColorToDOM({
      container,
      color: newColor,
      type,
      t,
    });

    const inserted = container?.querySelector(
      `.color-swatch-wrapper[data-color="${newColor}"]`,
    );

    requestAnimationFrame(() => {
      animateLayoutShift(container, before, { duration: 360 });
      animateNewSwatch(inserted);
    });

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
        detail: { type, color: newColor, fromPicker: false },
      }),
    );
  },

  _deleteColor(color, type) {
    const allowed = appProManager.requirePro("custom_colors", () =>
      showProMessage("custom_colors"),
    );
    if (!allowed) return;

    sm.vibrate(35, "medium");
    this._hideActionButton();

    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const wrapper = container?.querySelector(
      `.color-swatch-wrapper[data-color="${color}"]`,
    );
    if (!wrapper) return;

    const swatchesBefore = [
      ...container.querySelectorAll(".color-swatch-wrapper"),
    ];
    const removedIdx = swatchesBefore.indexOf(wrapper);
    const follower =
      removedIdx >= 0
        ? swatchesBefore[removedIdx + 1] ||
          swatchesBefore[removedIdx - 1] ||
          null
        : null;

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_DELETED, { detail: { type, color } }),
    );

    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;
    const didRemove = removeColorFromList(
      { normalizeHexColor },
      customColors,
      color,
    );
    if (didRemove) {
      persistCustomColors({ safeSetLS }, type, customColors);
    }

    animateDeleteSwatch(wrapper)
      .catch(() => {})
      .finally(() => {
        const before = captureRects(container);

        wrapper.remove();

        requestAnimationFrame(() => {
          animateLayoutShift(container, before, {
            duration: 380,
            springTarget: follower,
          });
        });
      });
  },

  populateColorSection(type) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );

    populateColorSection({
      container,
      type,
      standardColors: isAccent
        ? this.standardAccentColors
        : this.standardBgColors,
      customColors: isAccent ? this.customAccentColors : this.customBgColors,
      t,
    });
  },

  updateSelectionUI(type, color, doScroll = true) {
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );

    updateSelectionUI({
      container,
      type,
      color,
      doScroll,
      normalizeColor: normalize,
      themeManager,
      getCssVariable,
      hexToRGB,
      getLuminance,
      createSVGIcon,
    });
  },

  syncPickers(accentColor, bgColor) {
    const accentPicker = $("customColorInput");
    const bgPicker = $("customBgInput");
    const currentTheme = themeManager.getCurrentTheme();

    if (accentPicker) {
      const resolvedAccent =
        accentColor === "default"
          ? getCssVariable(`--default-accent-${currentTheme}`)
          : accentColor;
      accentPicker.value = normalizeHexColor(resolvedAccent);
    }

    if (bgPicker) {
      const resolvedBg =
        bgColor === "default"
          ? getCssVariable(`--default-bg-${currentTheme}`)
          : bgColor;
      bgPicker.value = normalizeHexColor(resolvedBg);
    }

    this.syncActiveAddButton();
  },

  syncActiveAddButton() {
    if (!this.activeActionTarget) return;

    const addButton = this.activeActionTarget.querySelector(
      '.color-action-btn[data-action="add"]',
    );
    if (!addButton) return;

    const picker = this.activeActionTarget.querySelector('input[type="color"]');
    if (picker) {
      updateAddButtonColor({
        button: addButton,
        color: picker.value,
        hexToRGB,
        getLuminance,
      });
    }
  },
};
