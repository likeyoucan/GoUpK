// Файл: www/js/timer/timer-inputs.js

export function setupTimerInputs(tm, { pad }) {
  tm.setupScrollInteraction = (input, max, isWrap) => {
    if (!input) return;
    let startY = 0;
    const threshold = 15;

    const updateVal = (delta) => {
      let val = parseInt(input.value || 0, 10);
      val += delta;

      if (isWrap) {
        if (val > max) val = 0;
        if (val < 0) val = max;
      } else {
        val = Math.max(0, Math.min(max, val));
      }

      input.value = pad(val);
      tm.sm.play("click");
      tm.sm.vibrate(10, "tactile");
    };

    input.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        updateVal(e.deltaY > 0 ? -1 : 1);
      },
      { passive: false },
    );

    input.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches[0].clientY;
      },
      { passive: true },
    );

    input.addEventListener(
      "touchmove",
      (e) => {
        const currentY = e.touches[0].clientY;
        const diff = startY - currentY;

        if (Math.abs(diff) > threshold) {
          e.preventDefault();
          if (document.activeElement === input) input.blur();
          updateVal(diff > 0 ? 1 : -1);
          startY = currentY;
        }
      },
      { passive: false },
    );

    let isDragging = false;

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const currentY = e.clientY;
      const diff = startY - currentY;

      if (Math.abs(diff) > threshold) {
        updateVal(diff > 0 ? 1 : -1);
        startY = currentY;
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseUp);
      window.removeEventListener("blur", onMouseUp);
    };

    input.addEventListener("mousedown", (e) => {
      isDragging = true;
      startY = e.clientY;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      document.addEventListener("mouseleave", onMouseUp);
      window.addEventListener("blur", onMouseUp);
    });
  };

  tm.bindInputEvents = () => {
    tm.els.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      document.activeElement?.blur();
    });

    [tm.els.m, tm.els.s].forEach((i) => {
      if (!i) return;

      i.addEventListener("focus", () => {
        if (i.value === "00" || i.value === "0") i.value = "";
      });

      i.addEventListener("input", () => {
        i.value = i.value.replace(/\D/g, "").slice(0, 2);
        if (parseInt(i.value, 10) > 59) i.value = "59";
        tm.isFinished = false;
      });

      i.addEventListener("blur", () => {
        i.value = pad(i.value || 0);
      });
    });

    if (tm.els.h) {
      tm.els.h.addEventListener("focus", () => {
        if (tm.els.h.value === "00" || tm.els.h.value === "0") {
          tm.els.h.value = "";
        }
      });

      tm.els.h.addEventListener("input", () => {
        tm.els.h.value = tm.els.h.value.replace(/\D/g, "").slice(0, 2);
        if (parseInt(tm.els.h.value, 10) > 99) tm.els.h.value = "99";
        tm.isFinished = false;
      });

      tm.els.h.addEventListener("blur", () => {
        tm.els.h.value = pad(tm.els.h.value || 0);
      });
    }

    tm.setupScrollInteraction(tm.els.h, 99, false);
    tm.setupScrollInteraction(tm.els.m, 59, true);
    tm.setupScrollInteraction(tm.els.s, 59, true);
  };
}
