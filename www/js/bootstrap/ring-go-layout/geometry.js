// Файл: www/js/bootstrap/ring-go-layout/geometry.js

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function snap2(px) {
    return Math.round(px * 2) / 2;
}

export function snap4(px) {
    return Math.round(px / 4) * 4;
}

export function getTopHalfEl(wrap) {
    return wrap?.closest(".view-top-half") || null;
}

export function getViewElFromWrap(wrap) {
    return (
        wrap?.closest("#view-stopwatch, #view-timer, #view-tabata") || null
    );
}

export function getRingWrapForDisplay(displayEl) {
    return displayEl?.closest(".timer-circle-wrap") || null;
}

export function isRowLayout(topHalfEl) {
    if (!topHalfEl) return false;

    const parentView = topHalfEl.closest(
        "#view-stopwatch, #view-timer, #view-tabata",
    );
    if (!parentView) return false;

    return getComputedStyle(parentView).flexDirection.startsWith("row");
}

export function isCompactViewport() {
    return window.innerHeight < 430 || window.innerWidth < 280;
}

export function isCompactRing(ringPx) {
    return ringPx < 180 || isCompactViewport();
}

export function calcDynamicRingSizePx(wrap) {
    const topHalfEl = getTopHalfEl(wrap);
    const rect = topHalfEl?.getBoundingClientRect?.();

    if (!rect) {
        const fallback = Math.min(wrap.clientWidth || 0, wrap.clientHeight || 0);
        const row = isRowLayout(topHalfEl);
        const isMobilePortrait = window.matchMedia(
            "(max-width: 767px) and (orientation: portrait)",
        ).matches;

        if (isMobilePortrait) {
            return snap4(clamp(fallback * 0.62, 148, 380));
        }

        return snap4(clamp(fallback * 0.68, 172, row ? 580 : 680));
    }

    const limitingSide = Math.min(rect.width, rect.height);
    const row = isRowLayout(topHalfEl);

    const isMobilePortrait = window.matchMedia(
        "(max-width: 767px) and (orientation: portrait)",
    ).matches;

    let k = row ? 0.64 : 0.92;
    if (isMobilePortrait) {
        k = 0.8;
    }

    const maxPx = row ? 580 : isMobilePortrait ? 560 : 680;
    const minPx = row ? 200 : isMobilePortrait ? 180 : 220;

    return snap4(clamp(limitingSide * k, minPx, maxPx));
}

export function getRenderedRingPx(wrap, fallback) {
    const r = wrap.getBoundingClientRect();
    const v = Math.min(r.width || 0, r.height || 0);
    return v > 0 ? v : fallback;
}