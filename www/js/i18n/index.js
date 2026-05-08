// Файл: www/js/i18n/index.js

import { safeGetLS, safeSetLS, safeRemoveLS } from "../utils.js?v=VERSION";
import { CustomSelect } from "../custom-select.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

import { en } from "./locales/en.js?v=VERSION";
import { ru } from "./locales/ru.js?v=VERSION";

export const translations = { en, ru };

export const langManager = {
  current: "en",
  langSelect: null,

  init() {
    const stored = safeGetLS(STORAGE_KEYS.APP_LANG);
    const initialLang = stored || "auto";

    if (this.langSelect) {
      this.langSelect.destroy();
      this.langSelect = null;
    }

    const langOptions = [
      { value: "auto", text: t("lang_auto") },
      { value: "en", text: "English" },
      { value: "ru", text: "Русский" },
    ];

    this.langSelect = new CustomSelect(
      "langSelectContainer",
      langOptions,
      (value) => {
        if (value === "auto") {
          const sys = navigator.language.startsWith("ru") ? "ru" : "en";
          this.setLang(sys, true);
          safeSetLS(STORAGE_KEYS.APP_LANG, "auto");
        } else {
          this.setLang(value);
        }
      },
      initialLang,
    );

    if (initialLang === "auto") {
      const sys = navigator.language.startsWith("ru") ? "ru" : "en";
      this.setLang(sys, true);
    } else {
      this.setLang(initialLang);
    }
  },

  resetSettings() {
    safeRemoveLS(STORAGE_KEYS.APP_LANG);
    this.init();
  },

  setLang(lang, isAuto = false) {
    this.current = translations[lang] ? lang : "en";
    document.documentElement.lang = this.current;

    if (!isAuto) {
      safeSetLS(STORAGE_KEYS.APP_LANG, this.current);
    }

    if (this.langSelect) {
      this.langSelect.options = [
        { value: "auto", text: t("lang_auto") },
        { value: "en", text: "English" },
        { value: "ru", text: "Русский" },
      ];
      this.langSelect.populateOptions();
      this.langSelect.setValue(isAuto ? "auto" : this.current, false);
    }

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const newText = t(key);

      if (el.children.length === 0) {
        el.textContent = newText;
        return;
      }

      const existingTextNode = Array.from(el.childNodes).find(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          node.nodeValue &&
          node.nodeValue.trim() !== "",
      );

      if (existingTextNode) {
        existingTextNode.nodeValue = newText;
      } else {
        const txt = document.createTextNode(newText);
        el.prepend(txt);
      }
    });

    document.dispatchEvent(new CustomEvent(APP_EVENTS.LANGUAGE_CHANGED));
  },
};

export function t(key) {
  return (
    (translations[langManager.current] &&
      translations[langManager.current][key]) ||
    translations.en[key] ||
    key
  );
}
