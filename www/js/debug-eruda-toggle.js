// Файл: www/js/debug-eruda-toggle.js

export function initErudaTapToggle() {
  const hitbox = document.getElementById("debug-eruda-hitbox");
  if (!hitbox) return;

  const TAP_TARGET = 3;
  const WINDOW_MS = 4500;

  let taps = 0;
  let firstTapAt = 0;
  let busy = false;

  const notify = (msg) => {
    const toastWrap = document.getElementById("toast");
    const toastMsg = document.getElementById("toast-msg");

    if (toastWrap && toastMsg) {
      toastMsg.textContent = msg;
      toastWrap.classList.remove("opacity-0", "-translate-y-4");
      setTimeout(() => {
        toastWrap.classList.add("opacity-0", "-translate-y-4");
      }, 1800);
    } else {
      alert(msg);
    }
  };

  const onTap = () => {
    if (busy) return;

    const now = Date.now();
    if (!firstTapAt || now - firstTapAt > WINDOW_MS) {
      firstTapAt = now;
      taps = 0;
    }

    taps += 1;

    if (taps >= TAP_TARGET) {
      busy = true;

      const isEnabled = localStorage.getItem("active-eruda") === "true";
      localStorage.setItem("active-eruda", isEnabled ? "false" : "true");

      notify(
        isEnabled ? "Debug mode disabled" : "Debug mode enabled. Reloading...",
      );

      setTimeout(() => {
        location.reload();
      }, 500);
    }
  };

  hitbox.addEventListener("pointerup", onTap, { passive: true });
  hitbox.addEventListener("click", onTap, { passive: true });
}
