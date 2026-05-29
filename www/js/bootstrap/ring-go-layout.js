// Файл: www/js/bootstrap/ring-go-layout.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getTopHalfEl(wrap) {
  return wrap.closest(".view-top-half");
}

function getRingWrapForDisplay(displayEl) {
  if (!displayEl) return null;
  return displayEl.closest(".timer-circle-wrap");
}

function isRowLayout(topHalfEl) {
  if (!topHalfEl) return false;

  const parentView = topHalfEl.closest(
    "#view-stopwatch, #view-timer, #view-tabata",
  );
  if (!parentView) return false;

  return getComputedStyle(parentView).flexDirection.startsWith("row");
}

function calcDynamicRingSizePx(wrap) {
  const topHalfEl = getTopHalfEl(wrap);
  const rect = topHalfEl?.getBoundingClientRect?.();

  if (!rect) {
    const fallback = Math.min(wrap.clientWidth || 0, wrap.clientHeight || 0);
    return Math.round(clamp(fallback * 0.68, 170, 420));
  }

  const limitingSide = Math.min(rect.width, rect.height);
  const row = isRowLayout(topHalfEl);

  const k = row ? 0.64 : 0.92;
  const maxPx = row ? 580 : 680;
  const minPx = row ? 230 : 220;

  return Math.round(clamp(limitingSide * k, minPx, maxPx));
}

function applyDisplayScale(displayEl, ringPx) {
  if (!displayEl || !ringPx) return;

  const text = String(displayEl.textContent || "").trim();
  const isGo =
    displayEl.classList.contains("is-go") && text.toUpperCase() === "GO";

  if (isGo) {
    const goPx = clamp(ringPx * 0.235, 48, 108);
    displayEl.style.setProperty("--go-font-dynamic", `${goPx}px`);
    return;
  }

  const hasMs = text.includes(".");
  const factor = hasMs ? 0.145 : 0.165;
  const timerPx = clamp(ringPx * factor, 24, 68);
  displayEl.style.setProperty("--timer-font-dynamic", `${timerPx}px`);
}

function centerGoDisplay(displayEl) {
  if (!displayEl) return;

  const text = String(displayEl.textContent || "")
    .trim()
    .toUpperCase();
  const isGo = displayEl.classList.contains("is-go") && text === "GO";

  if (!isGo) {
    displayEl.style.setProperty("--go-nudge-x", "0px");
    displayEl.style.setProperty("--go-nudge-y", "0px");
    return;
  }

  const host = displayEl.closest("button");
  if (!host) return;

  const hostRect = host.getBoundingClientRect();
  const textRect = displayEl.getBoundingClientRect();

  const hostCx = hostRect.left + hostRect.width / 2;
  const hostCy = hostRect.top + hostRect.height / 2;
  const textCx = textRect.left + textRect.width / 2;
  const textCy = textRect.top + textRect.height / 2;

  const dx = clamp(hostCx - textCx, -8, 8);
  const dy = clamp(hostCy - textCy, -8, 8);

  displayEl.style.setProperty("--go-nudge-x", `${dx.toFixed(2)}px`);
  displayEl.style.setProperty("--go-nudge-y", `${dy.toFixed(2)}px`);
}

export function initDynamicRingAndGoLayout() {
  const wraps = Array.from(document.querySelectorAll(".timer-circle-wrap"));
  const displays = [
    document.getElementById("sw-mainDisplay"),
    document.getElementById("tm-mainDisplay"),
    document.getElementById("tb-mainTimer"),
  ].filter(Boolean);

  if (!wraps.length && !displays.length) {
    return () => {};
  }

  let rafId = 0;

  const refreshNow = () => {
    rafId = 0;

    wraps.forEach((wrap) => {
      const px = calcDynamicRingSizePx(wrap);
      if (px <= 0) return;

      wrap.style.setProperty("--ring-size-dynamic", `${px}px`);

      displays.forEach((displayEl) => {
        const ownWrap = getRingWrapForDisplay(displayEl);
        if (ownWrap === wrap) {
          applyDisplayScale(displayEl, px);
        }
      });
    });

    displays.forEach((displayEl) => {
      if (!getRingWrapForDisplay(displayEl)) {
        applyDisplayScale(displayEl, 320);
      }
      centerGoDisplay(displayEl);
    });
  };

  const scheduleRefresh = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(refreshNow);
  };

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleRefresh)
      : null;

  wraps.forEach((wrap) => {
    ro?.observe(wrap);
    const topHalf = getTopHalfEl(wrap);
    if (topHalf) ro?.observe(topHalf);
  });

  displays.forEach((displayEl) => {
    ro?.observe(displayEl);
    const host = displayEl.closest("button");
    if (host) ro?.observe(host);
  });

  const textObservers = displays.map((displayEl) => {
    const mo = new MutationObserver(scheduleRefresh);
    mo.observe(displayEl, {
      characterData: true,
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return mo;
  });

  const onResize = () => scheduleRefresh();
  const onOrientation = () => scheduleRefresh();

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onOrientation, {
    passive: true,
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleRefresh).catch(() => {});
  }

  if (document.fonts?.addEventListener) {
    document.fonts.addEventListener("loadingdone", scheduleRefresh);
    document.fonts.addEventListener("loadingerror", scheduleRefresh);
  }

  scheduleRefresh();

  return () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    ro?.disconnect();
    textObservers.forEach((o) => o.disconnect());

    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onOrientation);

    if (document.fonts?.removeEventListener) {
      document.fonts.removeEventListener("loadingdone", scheduleRefresh);
      document.fonts.removeEventListener("loadingerror", scheduleRefresh);
    }
  };
}
