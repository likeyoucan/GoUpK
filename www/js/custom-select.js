// Файл: www/js/custom-select.js

/**
 * Модуль для создания полностью кастомизируемых выпадающих списков.
 * Заменяет нативный <select> на стилизуемые div-элементы, сохраняя
 * доступность и синхронизацию с оригинальным элементом.
 */

const activeSelects = new Set();

/**
 * "Улучшает" один элемент <select>, заменяя его кастомной версией.
 * @param {HTMLSelectElement} selectElement - Оригинальный <select> для улучшения.
 */
function enhanceSelect(selectElement) {
  if (selectElement.dataset.customSelectEnhanced) return;
  selectElement.dataset.customSelectEnhanced = "true";

  // --- Создание структуры ---
  const container = document.createElement("div");
  container.className = "custom-select-container";
  container.setAttribute("role", "listbox");
  container.setAttribute("tabindex", "0");

  const trigger = document.createElement("div");
  trigger.className = "custom-select-trigger";
  
  const selectedValue = document.createElement("span");
  selectedValue.className = "custom-select-value";

  const arrow = document.createElement("svg");
  arrow.setAttribute("focusable", "false");
  arrow.setAttribute("aria-hidden", "true");
  arrow.setAttribute("viewBox", "0 0 24 24");
  arrow.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>`;

  trigger.append(selectedValue, arrow);

  const optionsPanel = document.createElement("div");
  optionsPanel.className = "custom-select-options";
  
  const optionsList = document.createElement("ul");
  optionsPanel.append(optionsList);

  container.append(trigger, optionsPanel);
  
  // --- Заполнение опций и обновление триггера ---
  function populateOptions() {
    optionsList.innerHTML = "";
    const selectedOpt = selectElement.options[selectElement.selectedIndex];
    if(selectedOpt) {
      selectedValue.textContent = selectedOpt.textContent;
    }
    
    Array.from(selectElement.options).forEach((option, index) => {
      const li = document.createElement("li");
      li.className = "custom-select-option";
      li.setAttribute("role", "option");
      li.dataset.value = option.value;
      li.textContent = option.textContent;

      if (option.selected) {
        li.classList.add("is-selected");
        li.setAttribute("aria-selected", "true");
      } else {
        li.setAttribute("aria-selected", "false");
      }
      
      li.addEventListener("click", () => {
        selectOption(li, option);
        closeSelect(container);
      });
      optionsList.appendChild(li);
    });
  }

  function selectOption(li, optionElement) {
    if (selectElement.value === optionElement.value) return;

    // Снимаем выделение со старой опции
    const oldSelected = optionsList.querySelector(".is-selected");
    if (oldSelected) {
      oldSelected.classList.remove("is-selected");
      oldSelected.setAttribute("aria-selected", "false");
    }

    // Выделяем новую
    li.classList.add("is-selected");
    li.setAttribute("aria-selected", "true");
    selectedValue.textContent = optionElement.textContent;

    // Синхронизируем с нативным <select> и вызываем событие
    selectElement.value = optionElement.value;
    selectElement.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // --- Функции открытия/закрытия ---
  function openSelect(container) {
    // Закрыть все остальные открытые списки
    activeSelects.forEach(sel => {
      if (sel !== container) closeSelect(sel);
    });
    
    container.classList.add("is-open");
    container.querySelector('.custom-select-options').classList.add('is-open');
    activeSelects.add(container);
  }

  function closeSelect(container) {
    container.classList.remove("is-open");
    container.querySelector('.custom-select-options').classList.remove('is-open');
    activeSelects.delete(container);
  }

  function toggleSelect(container) {
    if (container.classList.contains("is-open")) {
      closeSelect(container);
    } else {
      openSelect(container);
    }
  }

  // --- Обработчики событий ---
  trigger.addEventListener("click", () => toggleSelect(container));
  container.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        toggleSelect(container);
        break;
      case "Escape":
        if (container.classList.contains("is-open")) {
          e.preventDefault();
          closeSelect(container);
        }
        break;
      // TODO: Добавить навигацию стрелками при необходимости
    }
  });
  
  // --- Интеграция в DOM ---
  selectElement.style.display = "none"; // Прячем оригинальный select
  selectElement.parentNode.insertBefore(container, selectElement);
  container.appendChild(selectElement); // Перемещаем select внутрь для связи

  populateOptions();

  // Следим за внешними изменениями (например, смена языка)
  const observer = new MutationObserver(populateOptions);
  observer.observe(selectElement, { childList: true, subtree: true, characterData: true });

  // Следим, если value меняется программно
  Object.defineProperty(selectElement, 'value', {
    get() {
      return Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').get.call(this);
    },
    set(v) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(this, v);
      populateOptions(); // Перерисовываем кастомный select
    },
    configurable: true
  });
}

// Глобальный обработчик для закрытия при клике вне элемента
document.addEventListener("click", (e) => {
  if (activeSelects.size === 0) return;
  const openSelect = Array.from(activeSelects)[0];
  if (openSelect && !openSelect.contains(e.target)) {
    closeSelect(openSelect);
  }
});


/**
 * Инициализирует все <select> на странице, помеченные селектором.
 * @param {string} [selector='select[data-custom-select]'] - CSS-селектор для поиска.
 */
export function initCustomSelects(selector = 'select[data-custom-select]') {
  document.querySelectorAll(selector).forEach(enhanceSelect);
}