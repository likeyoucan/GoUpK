// Файл: www/js/modal/bottom-sheet-drag.js

export class BottomSheetDragController {
  constructor({ getTopModal, closeCurrent }) {
    this.getTopModal = getTopModal;
    this.closeCurrent = closeCurrent;

    this.startBindings = new Map();

    this.isDragging = false;
    this.pointerType = null;
    this.startY = 0;
    this.currentY = 0;
    this.sheetEl = null;
    this.modalId = null;

    this.DRAG_START_THRESHOLD = 8;
    this.CLOSE_THRESHOLD = 100;

    this._onMove = null;
    this._onEnd = null;
  }

  bindStart(handleEl, modalId, getSheetEl) {
    if (!handleEl) return;

    const onTouchStart = (e) => {
      this._start(e.touches?.[0]?.clientY, "touch", modalId, getSheetEl);
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this._start(e.clientY, "mouse", modalId, getSheetEl);
    };

    handleEl.addEventListener("touchstart", onTouchStart, { passive: true });
    handleEl.addEventListener("mousedown", onMouseDown);

    this.startBindings.set(modalId, {
      el: handleEl,
      onTouchStart,
      onMouseDown,
    });
  }

  unbindStart(modalId) {
    const binding = this.startBindings.get(modalId);
    if (!binding) return;

    binding.el.removeEventListener("touchstart", binding.onTouchStart);
    binding.el.removeEventListener("mousedown", binding.onMouseDown);

    this.startBindings.delete(modalId);
  }

  destroy() {
    [...this.startBindings.keys()].forEach((id) => this.unbindStart(id));
    this._removeDocListeners();
    this._reset();
  }

  _start(y, pointerType, modalId, getSheetEl) {
    if (typeof y !== "number") return;
    if (this.isDragging) return;

    const top = this.getTopModal?.();
    if (!top || top.id !== modalId || top.type !== "bottom-sheet") return;

    const sheet = getSheetEl?.();
    if (!sheet || sheet.classList.contains("hidden")) return;

    this.isDragging = true;
    this.pointerType = pointerType;
    this.startY = y;
    this.currentY = y;
    this.sheetEl = sheet;
    this.modalId = modalId;

    this.sheetEl.style.transition = "none";
    this._addDocListeners(pointerType);
  }

  _addDocListeners(pointerType) {
    this._removeDocListeners();

    this._onMove = (e) => this._move(e);
    this._onEnd = () => this._end();

    if (pointerType === "touch") {
      document.addEventListener("touchmove", this._onMove, { passive: true });
      document.addEventListener("touchend", this._onEnd);
      document.addEventListener("touchcancel", this._onEnd);
    } else {
      document.addEventListener("mousemove", this._onMove);
      document.addEventListener("mouseup", this._onEnd);
      document.addEventListener("mouseleave", this._onEnd);
      window.addEventListener("blur", this._onEnd);
    }
  }

  _removeDocListeners() {
    if (this._onMove) {
      document.removeEventListener("touchmove", this._onMove);
      document.removeEventListener("mousemove", this._onMove);
      this._onMove = null;
    }

    if (this._onEnd) {
      document.removeEventListener("touchend", this._onEnd);
      document.removeEventListener("touchcancel", this._onEnd);
      document.removeEventListener("mouseup", this._onEnd);
      document.removeEventListener("mouseleave", this._onEnd);
      window.removeEventListener("blur", this._onEnd);
      this._onEnd = null;
    }
  }

  _move(e) {
    if (!this.isDragging || !this.sheetEl) return;

    const y =
      this.pointerType === "touch" ? e.touches?.[0]?.clientY : e.clientY;

    if (typeof y !== "number") return;

    this.currentY = y;
    const deltaY = this.currentY - this.startY;

    if (deltaY <= 0) return;
    if (deltaY < this.DRAG_START_THRESHOLD) return;

    this.sheetEl.style.transform = `translateY(${deltaY}px)`;
  }

  _end() {
    if (!this.isDragging || !this.sheetEl) {
      this._removeDocListeners();
      this._reset();
      return;
    }

    const deltaY = this.currentY - this.startY;
    const shouldClose = deltaY > this.CLOSE_THRESHOLD;

    const currentSheet = this.sheetEl;
    const currentModalId = this.modalId;

    this._removeDocListeners();
    this._reset();

    const top = this.getTopModal?.();
    if (!top || top.id !== currentModalId) return;

    if (shouldClose) {
      this.closeCurrent?.();
      return;
    }

    currentSheet.style.transition =
      "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
    currentSheet.style.transform = "translateY(0px)";
    setTimeout(() => {
      if (!currentSheet.classList.contains("hidden")) {
        currentSheet.style.transition = "";
        currentSheet.style.transform = "";
      }
    }, 400);
  }

  _reset() {
    this.isDragging = false;
    this.pointerType = null;
    this.startY = 0;
    this.currentY = 0;
    this.sheetEl = null;
    this.modalId = null;
  }
}
