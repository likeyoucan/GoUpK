// Файл: www/js/debug-eruda-toggle.js

// Hidden gesture: 15 fast taps/clicks on version block toggles Eruda.
export function initErudaTapToggle() {
  const hitbox = document.getElementById("debug-eruda-hitbox");
  if (!hitbox) return;

  const TAP_TARGET = 15;
  const WINDOW_MS = 4000;

  let taps = 0;
  let firstTapAt = 0;
  let lock = false;

  const notify = (msg) => {
    const toast = document.getElementById("toast-msg");
    const toastWrap = document.getElementById("toast");
    if (toast && toastWrap) {
      toast.textContent = msg;
      toastWrap.classList.remove("opacity-0", "-translate-y-4");
      setTimeout(() => {
        toastWrap.classList.add("opacity-0", "-translate-y-4");
      }, 1800);
    } else {
      alert(msg);
    }
  };

  const onTap = () => {
    if (lock) return;

    const now = Date.now();
    if (!firstTapAt || now - firstTapAt > WINDOW_MS) {
      firstTapAt = now;
      taps = 0;
    }

    taps += 1;

    if (taps >= TAP_TARGET) {
      lock = true;

      const enabled = localStorage.getItem("active-eruda") === "true";
      if (enabled) {
        localStorage.setItem("active-eruda", "false");
        notify("Eruda disabled");
      } else {
        localStorage.setItem("active-eruda", "true");
        notify("Eruda enabled");
      }

      setTimeout(() => location.reload(), 500);
    }
  };

  // pointerup covers mouse + touch on modern browsers
  hitbox.addEventListener("pointerup", onTap, { passive: true });
}
