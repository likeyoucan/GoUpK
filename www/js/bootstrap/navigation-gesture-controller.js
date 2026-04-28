// Файл: www/js/bootstrap/navigation-gesture-controller.js

export function bindNavSwipe({ appContainer, bottomNav, navigation, modalManager }) {
  if (!appContainer || !bottomNav) {
    console.warn("[swipe] Missing appContainer or bottomNav. Swipe disabled.");
    return () => {};
  }

  const tabs = ["stopwatch", "timer", "tabata", "settings"];

  let touchStartX = 0;
  let touchStartY = 0;
  let isSwipeCandidate = false;
  let isSwipeActive = false;

  const isInsideNavArea = (touch) => {
    const navRect = bottomNav.getBoundingClientRect();
    return touch.clientY >= navRect.top && touch.clientY <= navRect.bottom;
  };

  const onTouchStart = (e) => {
    if (modalManager.hasActiveModal()) return;
    if (navigation.isTransitioning) return;
    if (navigation.panel?.isDragging) return;

    const touch = e.touches[0];
    if (!touch || !isInsideNavArea(touch)) return;

    isSwipeCandidate = true;
    isSwipeActive = false;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  };

  const onTouchMove = (e) => {
    if (!isSwipeCandidate) return;
    if (navigation.panel?.isDragging) {
      isSwipeCandidate = false;
      isSwipeActive = false;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (!isSwipeActive && Math.abs(deltaX) > 14 && Math.abs(deltaY) < 26) {
      isSwipeActive = true;
      appContainer.classList.add("is-swiping");
      return;
    }

    if (!isSwipeActive && Math.abs(deltaY) > 26) {
      isSwipeCandidate = false;
      appContainer.classList.remove("is-swiping");
    }
  };

  const onTouchEnd = (e) => {
    if (!isSwipeCandidate) return;

    if (!isSwipeActive) {
      isSwipeCandidate = false;
      appContainer.classList.remove("is-swiping");
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (
      !navigation.panel?.isDragging &&
      Math.abs(deltaX) > 60 &&
      Math.abs(deltaY) < 100
    ) {
      const currentIdx = tabs.indexOf(navigation.activeView);

      if (deltaX < 0 && currentIdx < tabs.length - 1) {
        navigation.switchView(tabs[currentIdx + 1], { source: "swipe" });
      } else if (deltaX > 0 && currentIdx > 0) {
        navigation.switchView(tabs[currentIdx - 1], { source: "swipe" });
      }
    }

    isSwipeCandidate = false;
    isSwipeActive = false;
    touchStartX = 0;
    touchStartY = 0;
    appContainer.classList.remove("is-swiping");
  };

  const onTouchCancel = () => {
    isSwipeCandidate = false;
    isSwipeActive = false;
    touchStartX = 0;
    touchStartY = 0;
    appContainer.classList.remove("is-swiping");
  };

  appContainer.addEventListener("touchstart", onTouchStart, { passive: true });
  appContainer.addEventListener("touchmove", onTouchMove, { passive: true });
  appContainer.addEventListener("touchend", onTouchEnd, { passive: true });
  appContainer.addEventListener("touchcancel", onTouchCancel, { passive: true });

  return () => {
    appContainer.removeEventListener("touchstart", onTouchStart);
    appContainer.removeEventListener("touchmove", onTouchMove);
    appContainer.removeEventListener("touchend", onTouchEnd);
    appContainer.removeEventListener("touchcancel", onTouchCancel);
  };
}