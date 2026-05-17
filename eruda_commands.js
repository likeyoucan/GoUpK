// Подписка

(async () => {
  try {
    // Подхватываем тот же query v, что у main.js
    const mainScript = [...document.scripts].find((s) =>
      s.src.includes("/js/main.js"),
    );
    const v = mainScript ? new URL(mainScript.src).searchParams.get("v") : null;
    const q = v ? `?v=${v}` : "";

    const { appProManager } = await import(`./js/app-pro.js${q}`);

    // На всякий случай инициализация
    await appProManager.init();

    // Выберите режим:
    const MODE = "lifetime"; // "lifetime" | "subscription"

    // Нормальный путь (с подписью)
    if (window.crypto && crypto.subtle) {
      await appProManager.setMode(MODE);
      await appProManager.purchase();

      console.log("[TEST] Pro enabled (signed):", {
        purchased: appProManager.purchased,
        mode: appProManager.mode,
      });
      return;
    }

    // Фолбэк для окружений без crypto.subtle (только для теста текущей сессии)
    appProManager.mode = MODE;
    appProManager.purchased = true;

    localStorage.setItem("app_pro_mode", MODE);
    localStorage.setItem("app_pro_purchased", "true");

    // Если нужно, можно оставить текущие features как есть
    const rawFeatures = localStorage.getItem("app_pro_features");
    if (!rawFeatures) {
      localStorage.setItem(
        "app_pro_features",
        JSON.stringify({
          custom_colors: true,
          accent_bg: true,
          remove_ads: true,
          sound_themes: true,
          app_icon: true,
        }),
      );
    }

    localStorage.setItem("app_pro_updated_at", String(Date.now()));
    // Тестовая заглушка подписи (может быть пересброшена на revalidate)
    localStorage.setItem("app_pro_signature", "test_signature_fallback");

    document.dispatchEvent(
      new CustomEvent("proStatusChanged", {
        detail: { purchased: true, mode: MODE },
      }),
    );

    console.warn(
      "[TEST] Pro enabled via fallback (unsigned). If app revalidates, it may reset.",
    );
  } catch (e) {
    console.error("[TEST] Failed to enable Pro:", e, e?.stack);
  }
})();

// Скрипт для отключения

(async () => {
  try {
    const mainScript = [...document.scripts].find((s) =>
      s.src.includes("/js/main.js"),
    );
    const v = mainScript ? new URL(mainScript.src).searchParams.get("v") : null;
    const q = v ? `?v=${v}` : "";

    const { appProManager } = await import(`./js/app-pro.js${q}`);
    await appProManager.init();

    if (window.crypto && crypto.subtle) {
      await appProManager.revoke();
    } else {
      appProManager.purchased = false;
      localStorage.setItem("app_pro_purchased", "false");
      localStorage.setItem("app_pro_updated_at", String(Date.now()));
      document.dispatchEvent(
        new CustomEvent("proStatusChanged", {
          detail: { purchased: false, mode: appProManager.mode },
        }),
      );
    }

    console.log("[TEST] Pro disabled");
  } catch (e) {
    console.error("[TEST] Failed to disable Pro:", e, e?.stack);
  }
})();

// Проверка цветов




// Перезагрузка страницы

localStorage.setItem("active-eruda","true"); location.reload();