// Файл: www/js/modal/modal-stack-store.js

export class ModalStackStore {
  constructor() {
    this.stack = [];
  }

  clear() {
    this.stack = [];
  }

  hasAny() {
    return this.stack.length > 0;
  }

  has(id) {
    return this.stack.includes(id);
  }

  push(id) {
    if (!this.has(id)) this.stack.push(id);
  }

  remove(id) {
    this.stack = this.stack.filter((x) => x !== id);
  }

  topId() {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  }

  size() {
    return this.stack.length;
  }
}
