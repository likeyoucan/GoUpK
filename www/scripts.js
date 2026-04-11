(function () {
  // 1. Создаем элемент div
  const btn = document.createElement("div");

  // 2. Устанавливаем текст
  btn.textContent = "Очистить LocalStorage";

  // 3. Применяем начальные стили
  Object.assign(btn.style, {
    padding: "20px 40px",
    backgroundColor: "#e74c3c",
    position: "fixed",
    inset: "0 0 auto auto", // Сверху справа
    color: "white",
    fontSize: "18px",
    fontWeight: "bold",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "center",
    display: "inline-block",
    userSelect: "none",
    zIndex: "9999",
    margin: "10px",
    // Исправлено: значение в кавычках и объединение transition
    translate: "70% 0",
    transition: "background-color 0.3s, translate 0.3s ease-in-out",
  });

  // 4. Логика клика
  btn.onclick = function () {
    localStorage.clear();
    alert("LocalStorage очищен!");
  };

  // 5. Эффект при наведении (обрабатываем и цвет, и движение)
  btn.onmouseover = function () {
    this.style.backgroundColor = "#c0392b";
    this.style.translate = "0 0"; // Возвращаем в исходную позицию
  };

  btn.onmouseout = function () {
    this.style.backgroundColor = "#e74c3c";
    this.style.translate = "70% 0";
  };

  // 6. Добавляем элемент на страницу
  document.body.appendChild(btn);
})();
