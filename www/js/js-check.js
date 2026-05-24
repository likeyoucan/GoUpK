// Файл: www/js/js-check.js

(function () {
  const root = document.documentElement;
  root.classList.add("js");

  function ensureNoJsWarningVisible() {
    const warning = document.querySelector(".no-js-warning");
    if (!warning) return;
    warning.hidden = false;
    warning.setAttribute("aria-hidden", "false");
  }

  function showNoJsOverlay() {
    root.classList.add("__force-no-js");
    ensureNoJsWarningVisible();
  }

  function hideNoJsOverlay() {
    root.classList.remove("__force-no-js");
  }

  function toggleNoJsOverlay() {
    root.classList.toggle("__force-no-js");
    if (root.classList.contains("__force-no-js")) {
      ensureNoJsWarningVisible();
    }
  }

  // Public console API for QA
  window.__jsCheck = {
    show: showNoJsOverlay,
    hide: hideNoJsOverlay,
    toggle: toggleNoJsOverlay,
    isForced() {
      return root.classList.contains("__force-no-js");
    },
  };

  // Optional quick hint for QA
  console.info(
    "[js-check] Console API: __jsCheck.show(), __jsCheck.hide(), __jsCheck.toggle()",
  );
})();
