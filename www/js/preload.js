// Файл: www/js/preload.js

const PRELOADER_ID = "app-preloader";

export const preload = {
  el: null,
  isVisible: false,

  _ensureElement() {
    if (!this.el) {
      this.el = document.getElementById(PRELOADER_ID);
    }
    return this.el;
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
