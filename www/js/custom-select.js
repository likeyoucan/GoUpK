// www/js/custom-select.js

import { getCssVariable, hexToRGB, getLuminance } from "./utils.js?v=VERSION";

const activeSelects = new Set();
const TRANSITION_DURATION = 200;

export class CustomSelect {
  constructor(elementId, options, onSelect, initialValue) {
    this.container = document.getElementById(elementId);
    if (!this.container) return;

    this.options = options;
    this.onSelect = onSelect;
    this.currentValue = initialValue;
    this.isOpening = false;

    this.render();
    this.attachEventListeners();
    activeSelects.add(this);
  }

  destroy() {
    activeSelects.delete(this);
    this.container.replaceChildren();
    this.container.classList.remove(
      "custom-select-container",
      "relative",
      "is-open",
    );
  }

  render() {
    this.container.replaceChildren();

    this.trigger = document.createElement("div");
    this.trigger.className =
      "custom-select-trigger app-surface rounded-lg border app-border shadow-sm flex items-center justify-between w-full py-1.5 pl-3 pr-2 cursor-pointer transition-colors";
    this.trigger.setAttribute("role", "button");
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");

    this.selectedValueEl = document.createElement("span");
    this.selectedValueEl.className = "custom-select-value text-sm font-bold";

    const arrowSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    arrowSvg.setAttribute("focusable", "false");
    arrowSvg.setAttribute("aria-hidden", "true");
    arrowSvg.setAttribute("viewBox", "0 0 24 24");
    arrowSvg.classList.add(
      "w-4",
      "h-4",
      "app-text-sec",
      "transition-transform",
      "duration-300",
    );

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("d", "M19 9l-7 7-7-7");
    arrowSvg.appendChild(path);
    this.arrow = arrowSvg;

    this.trigger.append(this.selectedValueEl, this.arrow);

    this.optionsPanel = document.createElement("div");
    this.optionsPanel.className = "custom-select-options hidden";
    this.optionsPanel.setAttribute("role", "listbox");

    this.container.classList.add("custom-select-container", "relative");
    this.container.append(this.trigger, this.optionsPanel);

    this.populateOptions();
    this.setValue(this.currentValue, false);
  }

  populateOptions() {
    this.optionsPanel.replaceChildren();

    const fragment = document.createDocumentFragment();
    this.options.forEach((option) => {
      const optionEl = document.createElement("div");
      optionEl.className = "custom-select-option";
      optionEl.setAttribute("role", "option");
      optionEl.dataset.value = option.value;
      optionEl.appendChild(document.createTextNode(option.text));

      if (option.value === this.currentValue) {
        optionEl.classList.add("is-selected");
        optionEl.setAttribute("aria-selected", "true");
        this.updateSelectedTextColor(optionEl);
      } else {
        optionEl.setAttribute("aria-selected", "false");
      }

      fragment.appendChild(optionEl);
    });
    this.optionsPanel.appendChild(fragment);
  }

  attachEventListeners() {
    this.trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.optionsPanel.addEventListener("click", (e) => {
      const target = e.target.closest(".custom-select-option");
      if (target) {
        this.setValue(target.dataset.value);
        this.close();
      }
    });

    this.optionsPanel.addEventListener("mouseover", (e) => {
      const target = e.target.closest(".custom-select-option");
      if (target) this.updateSelectedTextColor(target);
    });
    this.optionsPanel.addEventListener("mouseout", (e) => {
      const target = e.target.closest(".custom-select-option");
      if (target) target.classList.remove("needs-dark-text");
    });
  }

  toggle() {
    this.isOpening ? this.close() : this.open();
  }

  open() {
    this.isOpening = true;
    activeSelects.forEach((s) => {
      if (s !== this && s.isOpening) s.close();
    });

    this.optionsPanel.classList.remove("hidden");
    requestAnimationFrame(() => {
      this.optionsPanel.classList.add("is-open");
      this.arrow.style.transform = "rotate(180deg)";
      this.trigger.setAttribute("aria-expanded", "true");
      this.container.classList.add("is-open");
    });
  }

  close() {
    this.isOpening = false;
    this.optionsPanel.classList.remove("is-open");
    this.arrow.style.transform = "";
    this.trigger.setAttribute("aria-expanded", "false");
    this.container.classList.remove("is-open");

    setTimeout(() => {
      if (!this.isOpening) {
        this.optionsPanel.classList.add("hidden");
      }
    }, TRANSITION_DURATION);
  }

  setValue(value, triggerOnSelect = true) {
    const selectedOption = this.options.find((opt) => opt.value === value);
    if (!selectedOption) return;

    this.currentValue = value;

    this.selectedValueEl.replaceChildren(
      document.createTextNode(selectedOption.text),
    );

    this.optionsPanel
      .querySelectorAll(".custom-select-option")
      .forEach((el) => {
        const isSelected = el.dataset.value === value;
        el.classList.toggle("is-selected", isSelected);
        el.setAttribute("aria-selected", isSelected.toString());
        if (isSelected) this.updateSelectedTextColor(el);
      });

    if (triggerOnSelect && typeof this.onSelect === "function") {
      this.onSelect(value);
    }
  }

  updateSelectedTextColor(selectedEl) {
    if (!selectedEl) return;
    const primaryColor = getCssVariable("--primary-color");
    const { r, g, b } = hexToRGB(primaryColor);
    const luminance = getLuminance(r, g, b);
    selectedEl.classList.toggle("needs-dark-text", luminance > 0.55);
  }
}

document.addEventListener("click", () => {
  activeSelects.forEach((s) => {
    if (s.isOpening) s.close();
  });
});

document.addEventListener("accentColorChanged", () => {
  activeSelects.forEach((s) => {
    const selectedEl = s.optionsPanel.querySelector(".is-selected");
    if (selectedEl) s.updateSelectedTextColor(selectedEl);
  });
});
