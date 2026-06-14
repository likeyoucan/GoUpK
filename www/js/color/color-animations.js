// Файл: www/js/color/color-animations.js

export function captureRects(container) {
  const map = new Map();
  if (!container) return map;

  container
    .querySelectorAll(".color-swatch-wrapper, .color-picker-wrapper")
    .forEach((el) => {
      map.set(el, el.getBoundingClientRect());
    });

  return map;
}

export function clearPickerFocusVisual(pickerWrapper, picker) {
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

export function animateLayoutShift(
  container,
  beforeMap,
  { duration = 320, springTarget = null } = {},
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
      const push = dx >= 0 ? -5 : 5;
      const rebound = -push * 0.36;
      const settle = push * 0.1;

      el.style.transformOrigin = "left center";

      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1,1)` },
          {
            transform: `translate(${push}px, 0) scale(1.05, 0.95)`,
            offset: 0.6,
          },
          {
            transform: `translate(${rebound}px, 0) scale(0.97, 1.03)`,
            offset: 0.84,
          },
          {
            transform: `translate(${settle}px, 0) scale(1.01, 0.99)`,
            offset: 0.94,
          },
          { transform: "translate(0,0) scale(1,1)" },
        ],
        {
          duration: 500,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
      return;
    }

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0,0)" },
      ],
      {
        duration,
        easing: "cubic-bezier(0.22, 0.9, 0.3, 1)",
      },
    );
  });
}

export function animateNewSwatch(el) {
  if (!el) return;

  el.animate(
    [
      { opacity: 0, transform: "translateY(3px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    {
      duration: 280,
      easing: "cubic-bezier(0.22, 0.9, 0.3, 1)",
    },
  );
}

export function animateDeleteSwatch(wrapper) {
  if (!wrapper) return Promise.resolve();

  return wrapper.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0.94, transform: "scale(0.97)", offset: 0.58 },
      { opacity: 0, transform: "scale(0.9)" },
    ],
    {
      duration: 300,
      easing: "cubic-bezier(0.22, 0.92, 0.28, 1)",
      fill: "forwards",
    },
  ).finished;
}
