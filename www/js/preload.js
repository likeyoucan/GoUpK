// Файл: www/js/preload.js

const PRELOADER_ID = "app-preloader";
const PRELOADER_ICON_ID = "app-preloader-icon";
const PRELOADER_ICON_NAME_ID = "app-preloader-icon-name";

export const preload = {
  el: null,
  isVisible: false,

  _ensureElement() {
    if (!this.el) {
      this.el = document.getElementById(PRELOADER_ID);
    }
    return this.el;
  },

  _ensureIcon() {
    return document.getElementById(PRELOADER_ICON_ID);
  },

  _ensureIconName() {
    return document.getElementById(PRELOADER_ICON_NAME_ID);
  },

  setIconMeta({ src, label } = {}) {
    const icon = this._ensureIcon();
    const iconName = this._ensureIconName();

    if (icon && src) {
      icon.src = src;
    }

    if (iconName) {
      const text = String(label || "").trim();
      iconName.textContent = text;
      iconName.classList.toggle("hidden", text.length === 0);
    }
  },

  show() {
    const el = this._ensureElement();
    if (!el) return;

    this.isVisible = true;
    document.body.classList.add("preload");

    el.hidden = false;
    el.classList.remove("is-hidden");
  },

  hide() {
    const el = this._ensureElement();
    if (!el) {
      document.body.classList.remove("preload");
      this.isVisible = false;
      return;
    }

    el.classList.add("is-hidden");
    this.isVisible = false;

    const onDone = () => {
      if (!this.isVisible) {
        el.hidden = true;
        document.body.classList.remove("preload");
      }
    };

    el.addEventListener("transitionend", onDone, { once: true });
    setTimeout(onDone, 350);
  },
};
