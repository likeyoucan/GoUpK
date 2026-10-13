// Файл: www/js/preload.js

const PRELOADER_ID = "app-preloader";
const PRELOADER_ICON_ID = "app-preloader-icon";
const PRELOADER_ICON_NAME_ID = "app-preloader-icon-name";
const MIN_PRELOADER_VISIBLE_MS = 1500;

export const preload = {
  el: null,
  isVisible: false,
  _iconLoadToken: 0,
  _shownAt: 0,
  _hideStartTimer: 0,
  _hideDoneTimer: 0,

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

  _clearHideTimers() {
    if (this._hideStartTimer) {
      clearTimeout(this._hideStartTimer);
      this._hideStartTimer = 0;
    }

    if (this._hideDoneTimer) {
      clearTimeout(this._hideDoneTimer);
      this._hideDoneTimer = 0;
    }
  },

  setIconMeta({ src, label } = {}) {
    const icon = this._ensureIcon();
    const iconName = this._ensureIconName();

    if (icon && src) {
      const token = ++this._iconLoadToken;

      // Keep icon hidden until selected icon is really loaded.
      icon.classList.add("is-loading-icon");

      const preloaderImg = new Image();
      preloaderImg.decoding = "async";

      preloaderImg.onload = () => {
        if (token !== this._iconLoadToken) return;
        icon.src = src;
        icon.classList.remove("is-loading-icon");
      };

      preloaderImg.onerror = () => {
        if (token !== this._iconLoadToken) return;
        // Keep current src, but stop infinite loading state.
        icon.classList.remove("is-loading-icon");
      };

      preloaderImg.src = src;
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

    this._clearHideTimers();

    this.isVisible = true;
    this._shownAt = performance.now();
    document.body.classList.add("preload");

    // Prevent default icon flash before selected icon is applied.
    const icon = this._ensureIcon();
    if (icon) {
      icon.classList.add("is-loading-icon");
    }

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

    this._clearHideTimers();

    const elapsed = performance.now() - (this._shownAt || 0);
    const waitMs = Math.max(0, MIN_PRELOADER_VISIBLE_MS - elapsed);

    const startHide = () => {
      el.classList.add("is-hidden");
      this.isVisible = false;

      const onDone = () => {
        if (!this.isVisible) {
          el.hidden = true;
          document.body.classList.remove("preload");
        }
      };

      el.addEventListener("transitionend", onDone, { once: true });

      this._hideDoneTimer = window.setTimeout(() => {
        this._hideDoneTimer = 0;
        onDone();
      }, 350);
    };

    if (waitMs > 0) {
      this._hideStartTimer = window.setTimeout(() => {
        this._hideStartTimer = 0;
        startHide();
      }, waitMs);
    } else {
      startHide();
    }
  },
};