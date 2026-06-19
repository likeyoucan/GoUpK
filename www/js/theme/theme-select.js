// Файл: www/js/theme/theme-select.js

import { CustomSelect } from "../custom-select.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";

function getThemeModeOptions() {
  return [
    {
      value: "system",
      text: t("theme_auto"),
      iconPaths: [
        "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z",
        "M8 21h8",
        "M12 17v4",
      ],
    },
    {
      value: "light",
      text: t("theme_light"),
      iconPaths: [
        "M12 3v2",
        "M12 19v2",
        "M3 12h2",
        "M19 12h2",
        "M5.64 5.64l1.41 1.41",
        "M16.95 16.95l1.41 1.41",
        "M5.64 18.36l1.41-1.41",
        "M16.95 7.05l1.41-1.41",
        "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
      ],
    },
    {
      value: "dark",
      text: t("theme_dark"),
      iconPaths: ["M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"],
    },
  ];
}

export function createThemeModeSelectController() {
  let select = null;

  const init = ({ currentMode, onSelectMode }) => {
    if (select) {
      select.destroy();
      select = null;
    }

    select = new CustomSelect(
      "themeModeSelectContainer",
      getThemeModeOptions(),
      (value) => onSelectMode(value),
      currentMode || "system",
    );
  };

  const syncValue = (mode) => {
    if (!select) return;
    select.setValue(mode, false);
  };

  const refreshTexts = (mode) => {
    if (!select) return;
    select.options = getThemeModeOptions();
    select.populateOptions();
    select.setValue(mode, false);
  };

  const destroy = () => {
    if (!select) return;
    select.destroy();
    select = null;
  };

  return {
    init,
    syncValue,
    refreshTexts,
    destroy,
  };
}
