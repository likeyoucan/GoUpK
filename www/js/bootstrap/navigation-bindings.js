// Файл: www/js/bootstrap/navigation-bindings.js

export function bindBottomNav({ navigation, modalManager, sm }) {
  const handlers = [];

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    const handler = (e) => {
      if (modalManager.hasActiveModal()) return;
      if (navigation.panel?.isDragging) return;

      const targetView = e.currentTarget.getAttribute("data-nav");
      if (!targetView || targetView === navigation.activeView) return;

      const switched = navigation.switchView(targetView, { source: "tap" });
      if (switched) {
        sm.vibrate(20, "light");
        requestAnimationFrame(() => navigation.refreshPanelLayout?.(true));
      }
    };

    btn.addEventListener("click", handler);
    handlers.push({ btn, handler });
  });

  return () => {
    handlers.forEach(({ btn, handler }) =>
      btn.removeEventListener("click", handler),
    );
  };
}
