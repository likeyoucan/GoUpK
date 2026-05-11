// Подписка

(async () => {
  try {
    const { appProManager } = await import("./js/app-pro.js");
    await appProManager.init();

    // Выберите режим: "lifetime" или "subscription"
    await appProManager.setMode("lifetime");

    // Активируем Pro
    await appProManager.purchase();

    console.log("[TEST] Pro enabled:", {
      purchased: appProManager.purchased,
      mode: appProManager.mode,
    });
  } catch (e) {
    console.error("[TEST] Failed to enable Pro:", e);
  }
})();

// Если нужно включить режим подписки вместо lifetime:

await appProManager.setMode("subscription");
await appProManager.purchase();

// Чтобы вернуть в free (для обратного теста), вставьте

(async () => {
  try {
    const { appProManager } = await import("./js/app-pro.js");
    await appProManager.init();
    await appProManager.revoke();
    console.log("[TEST] Pro disabled");
  } catch (e) {
    console.error("[TEST] Failed to disable Pro:", e);
  }
})();