(function () {
  const btn = document.createElement("div");
  btn.textContent = "Очистить LocalStorage";

  // Стили
  Object.assign(btn.style, {
    padding: "20px 40px",
    backgroundColor: "#e74c3c",
    position: "fixed",
    top: "20px",
    right: "0px",
    color: "white",
    fontSize: "18px",
    fontWeight: "bold",
    borderRadius: "10px 0 0 10px",
    cursor: "pointer",
    textAlign: "center",
    zIndex: "9999",
    userSelect: "none",
    transform: "translateX(90%)", 
    transition: "background-color 0.3s, transform 0.3s ease-in-out",
  });

  btn.onclick = function () {
    localStorage.clear();
    alert("LocalStorage очищен!");
  };

  // Эффект при наведении
  btn.onmouseover = function () {
    this.style.backgroundColor = "#c0392b";
    this.style.transform = "translateX(0)";
  };

  btn.onmouseout = function () {
    this.style.backgroundColor = "#e74c3c";
    this.style.transform = "translateX(79%)";
  };

  document.body.appendChild(btn);
})();