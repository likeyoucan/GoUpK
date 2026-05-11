// Файл: www/js/eruda.js

(async () => {
  const qa = (...a) => console.log("[QA]", ...a);
  const qaw = (...a) => console.warn("[QA]", ...a);
  const qae = (...a) => console.error("[QA]", ...a);

  try {
    const mainScript = [...document.scripts].find((s) =>
      s.src.includes("/js/main.js"),
    );
    if (!mainScript) throw new Error("main.js script tag not found");

    const mainUrl = new URL(mainScript.src, location.href);
    const v = mainUrl.searchParams.get("v");
    const q = v ? `?v=${v}` : "";

    const appProUrl = new URL(`./app-pro.js${q}`, mainUrl).href;
    const modalUrl = new URL(`./modal.js${q}`, mainUrl).href;

    const [{ appProManager }, { modalManager }] = await Promise.all([
      import(appProUrl),
      import(modalUrl),
    ]);

    await appProManager.init();
    await appProManager.setMode("lifetime");
    await appProManager.purchase();

    document.dispatchEvent(
      new CustomEvent("proStatusChanged", {
        detail: { purchased: true, mode: appProManager.mode },
      }),
    );
    document.dispatchEvent(new CustomEvent("languageChanged"));

    await new Promise((r) => setTimeout(r, 180));

    qa("Pro state:", {
      purchased: appProManager.purchased,
      mode: appProManager.mode,
      cryptoSubtle: !!(window.crypto && crypto.subtle),
    });

    const rows = [
      { id: "#setting-row-accent", key: "accent_bg" },
      { id: "#setting-row-bg", key: "accent_bg" },
      { id: "#setting-row-sound-theme", key: "sound_themes" },
      { id: "#setting-row-ads", key: "remove_ads" },
    ];

    const badgeReport = rows.map((r) => {
      const row = document.querySelector(r.id);
      const badge = row?.querySelector(`[data-pro-feature="${r.key}"]`);
      const wrap = badge?.closest("[data-pro-inline-wrap='1']");
      return {
        row: r.id,
        hasRow: !!row,
        hasBadge: !!badge,
        inlineNearLabel: !!wrap,
      };
    });

    qa("Badge report:", badgeReport);

    const soundContainer = document.getElementById("soundThemeSelectContainer");
    qa("soundThemeSelectContainer exists:", !!soundContainer);

    const status = document.getElementById("pro-status-badge");
    qa("Status text node:", {
      exists: !!status,
      text: status?.textContent?.trim() || "",
      className: status?.className || "",
    });

    modalManager.open("pro-subscribe-modal");
    await new Promise((r) => setTimeout(r, 120));
    const openOk = modalManager.hasActiveModal();
    modalManager.closeCurrent();
    await new Promise((r) => setTimeout(r, 450));
    const closeOk = !modalManager.hasActiveModal();

    qa("Modal smoke:", { openOk, closeOk });

    const failed =
      badgeReport.some((x) => !x.hasRow || !x.hasBadge || !x.inlineNearLabel) ||
      !openOk ||
      !closeOk;

    if (failed) qaw("Some checks failed. Inspect report above.");
    else qa("All critical checks passed.");

    window.__qaProOn = async (mode = "lifetime") => {
      await appProManager.setMode(mode);
      await appProManager.purchase();
      document.dispatchEvent(
        new CustomEvent("proStatusChanged", {
          detail: { purchased: true, mode: appProManager.mode },
        }),
      );
      qa("__qaProOn done:", {
        purchased: appProManager.purchased,
        mode: appProManager.mode,
      });
    };

    window.__qaProOff = async () => {
      await appProManager.revoke();
      document.dispatchEvent(
        new CustomEvent("proStatusChanged", {
          detail: { purchased: false, mode: appProManager.mode },
        }),
      );
      qa("__qaProOff done");
    };

    window.__qaOpenPaywall = () => modalManager.open("pro-subscribe-modal");
    window.__qaCloseModal = () => modalManager.closeCurrent();

    qa(
      "Helpers ready: __qaProOn(mode), __qaProOff(), __qaOpenPaywall(), __qaCloseModal()",
    );
  } catch (e) {
    qae("QA script failed:", e, e?.stack);
  }
})();
