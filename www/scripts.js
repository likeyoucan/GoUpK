(function() {
    // 1. Создаем элемент div
    const btn = document.createElement('div');
    
    // 2. Устанавливаем текст
    btn.textContent = 'Очистить LocalStorage';
    
    // 3. Применяем стили через свойство style
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
        transition: "background-color 0.3s",
        zIndex: "9999", // Чтобы кнопка была поверх других элементов
        margin: "10px"  // Небольшой отступ от края экрана
    });

    // 4. Логика клика
    btn.onclick = function() {
        localStorage.clear();
        alert('LocalStorage очищен!');
    };

    // 5. Эффект при наведении (аналог hover)
    btn.onmouseover = function() {
        this.style.backgroundColor = '#c0392b';
    };

    btn.onmouseout = function() {
        this.style.backgroundColor = '#e74c3c';
    };

    // 6. Добавляем элемент на страницу
    document.body.appendChild(btn);
})();