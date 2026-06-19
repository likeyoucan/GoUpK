// Файл: www/js/bootstrap/split-resizer/view-controller.js

import { DRAG } from "./constants.js?v=VERSION";
import {
    clamp,
    isRowLayout,
    isNearSquareLandscape,
    getViewportRawMax,
    getMiddleAnchor,
    getForcedTargetForViewport,
    nearestAnchor,
    getInertiaTuning,
} from "./viewport.js?v=VERSION";
import {
    setCollapseFx,
    applyOverlayFlag,
    applySnapToAll,
    getTargetFromGlobalSnap,
} from "./apply.js?v=VERSION";

export function setupOneView(ctx, viewCtx) {
    const { viewEl, handler } = viewCtx;
    if (!viewEl || !handler) return () => { };

    const localDisposers = [];
    const on = (el, event, fn, options) => {
        el.addEventListener(event, fn, options);
        localDisposers.push(() => el.removeEventListener(event, fn, options));
    };

    let dragging = false;
    let activePointerType = "touch";
    let lastRaw = getTargetFromGlobalSnap(ctx);

    let lastTs = 0;
    let lastRawForVel = lastRaw;
    let velocity = 0;
    let tapTimer = null;

    let windowMoveHandler = null;
    let windowUpHandler = null;

    const removeWindowDragListeners = () => {
        if (windowMoveHandler) {
            window.removeEventListener("pointermove", windowMoveHandler);
            windowMoveHandler = null;
        }
        if (windowUpHandler) {
            window.removeEventListener("pointerup", windowUpHandler);
            window.removeEventListener("pointercancel", windowUpHandler);
            windowUpHandler = null;
        }
    };

    const getAnchors = () => {
        const forced = getForcedTargetForViewport();
        if (forced != null) return [forced];
        return [0, getMiddleAnchor(), 100];
    };

    const pointerToRaw = (ev) => {
        const rect = viewEl.getBoundingClientRect();
        const rawMax = getViewportRawMax();

        if (isRowLayout(viewEl)) {
            return clamp(
                ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100,
                0,
                rawMax,
            );
        }

        const bottomHalf = viewEl.querySelector(".view-bottom-half");
        const bottomPad = bottomHalf
            ? parseFloat(getComputedStyle(bottomHalf).paddingBottom || "0")
            : 0;

        const handlerPx = handler.getBoundingClientRect().height || 16;
        const usableHeight = Math.max(1, rect.height - bottomPad - handlerPx);

        return clamp(((ev.clientY - rect.top) / usableHeight) * 100, 0, rawMax);
    };

    const applyLive = (raw) => {
        const rawMax = getViewportRawMax();
        const forced = getForcedTargetForViewport();

        lastRaw = clamp(raw, 0, rawMax);
        if (forced != null) lastRaw = forced;
        lastRaw = Math.min(lastRaw, rawMax);

        viewEl.classList.toggle(
            "split-force-middle",
            forced !== null && forced !== 0 && forced !== 100,
        );

        viewEl.classList.add("split-live");
        viewEl.classList.remove(
            "split-top-hidden",
            "split-middle",
            "split-bottom-hidden",
        );

        viewEl.dataset.splitTarget = lastRaw >= 96.5 ? "bottom" : "";

        applyOverlayFlag(ctx, viewEl, null, { liveRaw: lastRaw });

        viewEl.style.setProperty("--split", `${lastRaw}%`);
        setCollapseFx(viewEl, lastRaw);

        handler.setAttribute("aria-valuenow", String(Math.round(lastRaw)));
    };

    const snapFromCurrent = () => {
        const anchors = getAnchors();
        const tuning = getInertiaTuning(activePointerType);

        if (anchors.length === 1) {
            applySnapToAll(ctx, anchors[0], { animate: true, duration: 220 });
            return;
        }

        const inertiaShift = clamp(
            velocity * tuning.gain,
            -tuning.maxShift,
            tuning.maxShift,
        );

        const projected = clamp(lastRaw + inertiaShift, 0, getViewportRawMax());
        const middle = getMiddleAnchor();

        let target;
        if (isNearSquareLandscape()) {
            if (Math.abs(projected - 0) <= DRAG.SNAP_THRESHOLD) target = 0;
            else target = middle;
        } else {
            if (Math.abs(projected - 0) <= DRAG.SNAP_THRESHOLD) target = 0;
            else if (Math.abs(projected - middle) <= DRAG.SNAP_THRESHOLD) target = middle;
            else if (Math.abs(projected - 100) <= DRAG.SNAP_THRESHOLD) target = 100;
            else target = nearestAnchor(projected, anchors);
        }

        applySnapToAll(ctx, target, { animate: true, duration: tuning.duration });
    };

    const cycleState = () => {
        const forced = getForcedTargetForViewport();
        if (forced != null) {
            applySnapToAll(ctx, forced, { animate: true, duration: 220 });
            return;
        }

        const middle = getMiddleAnchor();
        const currentTarget = getTargetFromGlobalSnap(ctx);

        if (isNearSquareLandscape()) {
            applySnapToAll(ctx, currentTarget === 0 ? middle : 0, {
                animate: true,
                duration: 240,
            });
            return;
        }

        if (currentTarget === 0) {
            applySnapToAll(ctx, middle, { animate: true, duration: 240 });
            return;
        }

        if (currentTarget === middle) {
            applySnapToAll(ctx, 100, { animate: true, duration: 240 });
            return;
        }

        applySnapToAll(ctx, 0, { animate: true, duration: 240 });
    };

    handler.setAttribute("tabindex", "0");
    handler.setAttribute("aria-label", "Split view size");

    const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();

        dragging = true;
        activePointerType = e.pointerType || "touch";
        velocity = 0;
        lastTs = performance.now();

        lastRaw =
            parseFloat(viewEl.style.getPropertyValue("--split")) ||
            getTargetFromGlobalSnap(ctx);

        lastRawForVel = lastRaw;
        handler.classList.add("is-dragging");
        handler.setPointerCapture?.(e.pointerId);

        const onMove = (ev) => {
            if (!dragging) return;

            const raw = pointerToRaw(ev);
            const now = performance.now();
            const dt = Math.max(1, now - lastTs);
            const instV = (raw - lastRawForVel) / dt;

            const tune = getInertiaTuning(activePointerType);
            velocity = velocity * tune.keep + instV * tune.add;

            lastTs = now;
            lastRawForVel = raw;

            applyLive(raw);
        };

        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            handler.classList.remove("is-dragging");
            snapFromCurrent();
            removeWindowDragListeners();
        };

        windowMoveHandler = onMove;
        windowUpHandler = onUp;

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    };

    const onClick = () => {
        if (dragging) return;

        if (tapTimer) {
            clearTimeout(tapTimer);
            tapTimer = null;
            cycleState();
            return;
        }

        tapTimer = setTimeout(() => {
            tapTimer = null;
        }, DRAG.DOUBLE_TAP_MS);
    };

    const onKeydown = (e) => {
        const forced = getForcedTargetForViewport();
        if (forced != null) {
            e.preventDefault();
            applySnapToAll(ctx, forced, { animate: true, duration: 220 });
            return;
        }

        const middle = getMiddleAnchor();
        const endTarget = isNearSquareLandscape() ? middle : 100;

        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            cycleState();
            return;
        }

        if (e.key === "Home") {
            e.preventDefault();
            applySnapToAll(ctx, 0, { animate: true, duration: 220 });
            return;
        }

        if (e.key === "End") {
            e.preventDefault();
            applySnapToAll(ctx, endTarget, { animate: true, duration: 220 });
            return;
        }

        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            applySnapToAll(ctx, 0, { animate: true, duration: 220 });
            return;
        }

        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            applySnapToAll(ctx, endTarget, { animate: true, duration: 220 });
            return;
        }

        if (e.key === "m" || e.key === "M") {
            e.preventDefault();
            applySnapToAll(ctx, middle, { animate: true, duration: 220 });
        }
    };

    on(handler, "pointerdown", onPointerDown);
    on(handler, "click", onClick);
    on(handler, "keydown", onKeydown);

    return () => {
        if (tapTimer) {
            clearTimeout(tapTimer);
            tapTimer = null;
        }

        dragging = false;
        removeWindowDragListeners();

        localDisposers.forEach((off) => {
            try {
                off?.();
            } catch (err) {
                console.error("[split-resizer.dispose.view]", err);
            }
        });
    };
}