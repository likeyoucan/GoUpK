// Файл: www/js/bootstrap/ring-go-layout.js

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function snap4(px) {
  return Math.round(px / 4) * 4;
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
    return snap4(clamp(fallback * 0.68, 172, 420));
  }

  const limitingSide = Math.min(rect.width, rect.height);
  const row = isRowLayout(topHalfEl);

  const k = row ? 0.64 : 0.92;
  const maxPx = row ? 580 : 680;
  const minPx = row ? 232 : 220;

  return snap4(clamp(limitingSide * k, minPx, maxPx));
}

function applyDisplayScale(displayEl, ringPx, rowLayout) {
  if (!displayEl || !ringPx) return;

  const text = String(displayEl.textContent || "").trim();
  const isGo =
    displayEl.classList.contains("is-go") && text.toUpperCase() === "GO";

  if (isGo) {
    // Unified GO ratio for all layouts to keep visual size consistent
    // across desktop/mobile and portrait/landscape.
    const goRatio = 0.266;
    const raw = ringPx * goRatio;
    const goPx = snap4(clamp(raw, 60, 120));

    displayEl.style.setProperty("--go-font-dynamic", `${goPx}px`);
    displayEl.style.setProperty("--go-skew-deg", "-11deg");
    return;
  }

  const hasMs = text.includes(".");
  const base = rowLayout ? (hasMs ? 0.132 : 0.152) : hasMs ? 0.124 : 0.144;
  const rawTimer = ringPx * base;
  const timerPx = snap4(clamp(rawTimer, 24, rowLayout ? 60 : 56));

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

  // Reset offsets before measuring
  displayEl.style.setProperty("--go-nudge-x", "0px");
  displayEl.style.setProperty("--go-nudge-y", "0px");

  const hostRect = host.getBoundingClientRect();
  const textRect = displayEl.getBoundingClientRect();

  const hostCx = hostRect.left + hostRect.width / 2;
  const hostCy = hostRect.top + hostRect.height / 2;
  const textCx = textRect.left + textRect.width / 2;
  const textCy = textRect.top + textRect.height / 2;

  const fontPx = parseFloat(getComputedStyle(displayEl).fontSize) || 0;
  const skewDeg =
    parseFloat(getComputedStyle(displayEl).getPropertyValue("--go-skew-deg")) ||
    -11;
  const skewRad = Math.abs(skewDeg) * (Math.PI / 180);

  // Optical compensation based on actual skew and size, not viewport mode.
  const opticalCompX = clamp(Math.tan(skewRad) * fontPx * 0.16, 0.6, 3.6);
  const opticalCompY = -clamp(fontPx * 0.012, 0.4, 1.8);

  const dx = clamp(hostCx - textCx + opticalCompX, -10, 10);
  const dy = clamp(hostCy - textCy + opticalCompY, -10, 10);

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

      const topHalf = getTopHalfEl(wrap);
      const rowLayout = isRowLayout(topHalf);

      displays.forEach((displayEl) => {
        const ownWrap = getRingWrapForDisplay(displayEl);
        if (ownWrap === wrap) {
          applyDisplayScale(displayEl, px, rowLayout);
        }
      });
    });

    displays.forEach((displayEl) => {
      if (!getRingWrapForDisplay(displayEl)) {
        applyDisplayScale(displayEl, 320, false);
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
