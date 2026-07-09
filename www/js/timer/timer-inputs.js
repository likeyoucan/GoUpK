// Файл: www/js/timer/timer-inputs.js

export function setupTimerInputs(tm, { pad }) {
  tm._scrollInputDisposers = tm._scrollInputDisposers || [];

  tm.setupScrollInteraction = (input, max, isWrap) => {
    if (!input) return () => {};

    let startY = 0;
    const threshold = 15;
    const localDisposers = [];

    const on = (el, event, handler, options) => {
      el.addEventListener(event, handler, options);
      localDisposers.push(() =>
        el.removeEventListener(event, handler, options),
      );
    };

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

    const onWheel = (e) => {
      e.preventDefault();
      updateVal(e.deltaY > 0 ? -1 : 1);
    };
    on(input, "wheel", onWheel, { passive: false });

    const onTouchStart = (e) => {
      startY = e.touches[0].clientY;
    };
    on(input, "touchstart", onTouchStart, { passive: true });

    const onTouchMove = (e) => {
      const currentY = e.touches[0].clientY;
      const diff = startY - currentY;

      if (Math.abs(diff) > threshold) {
        e.preventDefault();
        if (document.activeElement === input) input.blur();
        updateVal(diff > 0 ? 1 : -1);
        startY = currentY;
      }
    };
    on(input, "touchmove", onTouchMove, { passive: false });

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

    const onMouseDown = (e) => {
      isDragging = true;
      startY = e.clientY;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      document.addEventListener("mouseleave", onMouseUp);
      window.addEventListener("blur", onMouseUp);
    };
    on(input, "mousedown", onMouseDown);

    const dispose = () => {
      onMouseUp();
      localDisposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[timer-inputs.scroll.dispose]", err);
        }
      });
    };

    tm._scrollInputDisposers.push(dispose);
    return dispose;
  };

  tm.bindInputEvents = () => {
    tm._unbindInputEvents?.();

    const disposers = [];
    const bind = (el, event, handler, options) => {
      if (!el) return;
      el.addEventListener(event, handler, options);
      disposers.push(() => el.removeEventListener(event, handler, options));
    };

    const onFormSubmit = (e) => {
      e.preventDefault();
      document.activeElement?.blur();
    };
    bind(tm.els.form, "submit", onFormSubmit);

    [tm.els.m, tm.els.s].forEach((i) => {
      if (!i) return;

      const onFocus = () => {
        if (i.value === "00" || i.value === "0") i.value = "";
      };

      const onInput = () => {
        i.value = i.value.replace(/\D/g, "").slice(0, 2);
        if (parseInt(i.value, 10) > 59) i.value = "59";
      };

      const onBlur = () => {
        i.value = pad(i.value || 0);
      };

      bind(i, "focus", onFocus);
      bind(i, "input", onInput);
      bind(i, "blur", onBlur);
    });

    if (tm.els.h) {
      const onHFocus = () => {
        if (tm.els.h.value === "00" || tm.els.h.value === "0") {
          tm.els.h.value = "";
        }
      };

      const onHInput = () => {
        tm.els.h.value = tm.els.h.value.replace(/\D/g, "").slice(0, 2);
        if (parseInt(tm.els.h.value, 10) > 99) tm.els.h.value = "99";
      };

      const onHBlur = () => {
        tm.els.h.value = pad(tm.els.h.value || 0);
      };

      bind(tm.els.h, "focus", onHFocus);
      bind(tm.els.h, "input", onHInput);
      bind(tm.els.h, "blur", onHBlur);
    }

    tm._scrollInputDisposers.forEach((off) => {
      try {
        off?.();
      } catch {}
    });
    tm._scrollInputDisposers = [];

    tm.setupScrollInteraction(tm.els.h, 99, false);
    tm.setupScrollInteraction(tm.els.m, 59, true);
    tm.setupScrollInteraction(tm.els.s, 59, true);

    tm._unbindInputEvents = () => {
      disposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[timer-inputs.dispose]", err);
        }
      });

      tm._scrollInputDisposers.forEach((off) => {
        try {
          off?.();
        } catch {}
      });
      tm._scrollInputDisposers = [];
    };
  };
}
