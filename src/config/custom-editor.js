/**
 * Custom styling panel: typography, message card, display, and colors.
 * Rendered into #cfg-custom-panel; listeners wired by attachCustomPanelListeners.
 */

const CUSTOM_TABS = ["typography", "messages", "display", "colors"];

function colorRow(label, key, hex) {
  const clean = String(hex || "").replace(/^#/, "");
  const valid = /^[0-9a-fA-F]{6}$/.test(clean);
  const colorValue = valid ? `#${clean}` : "#ffffff";
  const textValue = valid ? `#${clean}` : "";
  return `
    <div class="cfg-color-row">
      <span class="cfg-color-label">${label}</span>
      <div class="cfg-color-input">
        <input type="color" class="cfg-color-wheel" value="${colorValue}" data-color-key="${key}" title="${label}" />
        <input type="text" class="cfg-color-hex" maxlength="7" placeholder="—" value="${textValue}" data-color-hex-key="${key}" />
      </div>
    </div>
  `;
}

function layoutShowsTickerSpeed(layout) {
  return layout === "bar" || layout === "ticker";
}

export function renderCustomPanel(panel, state, activeCustomTab, helpers) {
  const { sliderRow, toggleRow } = helpers;
  panel.innerHTML = `
    <div class="cfg-custom-header">
      <span class="cfg-custom-title">Custom editor</span>
      <button class="cfg-custom-back" type="button" id="btn-close-custom">
        Back
      </button>
    </div>

    <div class="cfg-custom-tabs">
      ${CUSTOM_TABS.map(
        (tab) => `
        <button type="button" class="cfg-custom-tab ${
          activeCustomTab === tab ? "cfg-tab-active" : ""
        }" data-custom-tab="${tab}">
          ${tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      `
      ).join("")}
    </div>

    <div class="cfg-custom-body">

      <div class="cfg-custom-section ${
        activeCustomTab === "typography" ? "cfg-section-active" : ""
      }" data-section="typography">

        <div class="cfg-sub-label">Font family</div>
        <div class="cfg-btn-group">
          ${[["system", "System"], ["inter", "Inter"], ["mono", "Mono"], ["serif", "Serif"]]
            .map(
              ([v, l]) => `
            <button type="button" class="cfg-btn cfg-sm-btn ${
              state.fontFamily === v ? "cfg-active" : ""
            }" data-set-key="fontFamily" data-set-value="${v}">
              ${l}
            </button>
          `
            )
            .join("")}
        </div>

        <div class="cfg-sub-label" style="margin-top:8px">Font weight</div>
        <div class="cfg-btn-group">
          ${[["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Bold"]]
            .map(
              ([v, l]) => `
            <button type="button" class="cfg-btn cfg-sm-btn ${
              state.fontWeight === v ? "cfg-active" : ""
            }" data-set-key="fontWeight" data-set-value="${v}">
              ${l}
            </button>
          `
            )
            .join("")}
        </div>

        ${sliderRow("Font size", "fontSize", 11, 22, 1, state.fontSize)}
        ${sliderRow("Emote size", "emoteSize", 14, 48, 2, state.emoteSize)}
        ${sliderRow("Badge size", "badgeSize", 12, 32, 2, state.badgeSize)}
      </div>

      <div class="cfg-custom-section ${
        activeCustomTab === "messages" ? "cfg-section-active" : ""
      }" data-section="messages">

        ${sliderRow("Corner radius", "msgRadius", 0, 24, 1, state.msgRadius)}
        ${sliderRow("Padding", "msgPadding", 2, 24, 1, state.msgPadding)}
        ${sliderRow("Background opacity", "msgOpacity", 0, 100, 5, state.msgOpacity)}
        ${sliderRow("Max width", "msgMaxWidth", 200, 800, 10, state.msgMaxWidth)}

        ${
          layoutShowsTickerSpeed(state.layout)
            ? sliderRow("Ticker speed", "tickerSpeed", 5, 60, 1, state.tickerSpeed)
            : ""
        }
      </div>

      <div class="cfg-custom-section ${
        activeCustomTab === "display" ? "cfg-section-active" : ""
      }" data-section="display">

        ${toggleRow("Show badges", "showBadges", "")}
        ${toggleRow("Show pronouns", "showPronouns", "")}
        ${toggleRow("Show timestamp", "showTimestamp", "")}
        ${toggleRow(
          "Compact mode",
          "compactMode",
          "Reduces padding and font size globally"
        )}
        ${toggleRow("Use chat colors", "useUsernameColor", "Platform username colors")}
        ${toggleRow(
          "Platform tint",
          "platformTintMessages",
          "Purple / red / green stripe per platform"
        )}
        ${toggleRow("Platform label", "showPlatformTag", "TWITCH / YOUTUBE / KICK pill")}
        ${toggleRow("Transparent bg", "transparent", "")}
      </div>

      <div class="cfg-custom-section ${
        activeCustomTab === "colors" ? "cfg-section-active" : ""
      }" data-section="colors">

        <div class="cfg-platform-info" style="margin-bottom:4px">
          Pick colors with the wheel or type <strong>#RRGGBB</strong>. Leave blank to use the theme defaults.
        </div>

        ${colorRow("Message text", "customTextColor", state.customTextColor)}
        ${colorRow("Muted text", "customMutedColor", state.customMutedColor)}
        ${colorRow("Message background", "customMsgBgColor", state.customMsgBgColor)}
        ${colorRow("Accent", "customAccentColor", state.customAccentColor)}

        <button type="button" class="cfg-btn cfg-sm-btn" data-clear-colors="1" style="align-self:flex-start">
          Reset colors
        </button>
      </div>

    </div>
  `;
}

/**
 * @param {HTMLElement} panel
 * @param {{ update: (p: object) => void, onBack: () => void, onTabChange: (tab: string) => void, debounce: (fn: () => void, ms: number) => void }} ctx
 */
export function attachCustomPanelListeners(panel, ctx) {
  const { update, onBack, onTabChange, debounce } = ctx;

  panel.querySelector("#btn-close-custom")?.addEventListener("click", () => {
    onBack();
  });

  panel.querySelectorAll("[data-custom-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      onTabChange(tab.dataset.customTab || "typography");
    });
  });

  panel.querySelectorAll("[data-set-key]").forEach((btn) => {
    btn.addEventListener("click", () =>
      update({ [btn.dataset.setKey]: btn.dataset.setValue })
    );
  });

  panel.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", () =>
      update({ [input.dataset.toggleKey]: input.checked })
    );
  });

  panel.querySelector("[data-clear-colors]")?.addEventListener("click", () => {
    update({
      customTextColor: "",
      customMutedColor: "",
      customMsgBgColor: "",
      customAccentColor: ""
    });
  });

  const rangeUnit = (key, val) => {
    const map = {
      fontSize: "px",
      emoteSize: "px",
      badgeSize: "px",
      msgRadius: "px",
      msgPadding: "px",
      msgMaxWidth: "px",
      msgOpacity: "%",
      tickerSpeed: "s",
      maxMessages: ""
    };
    const u = map[key];
    return u === undefined ? String(val) : `${val}${u}`;
  };

  panel.querySelectorAll("[data-range-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.rangeKey;
      const val = Number(input.value);
      const label = document.getElementById(`val-${key}`);
      if (label && key) label.textContent = rangeUnit(key, val);
      debounce(() => update({ [key]: val }), 300);
    });
  });

  panel.querySelectorAll("input.cfg-color-wheel[data-color-key]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const key = inp.dataset.colorKey;
      if (!key) return;
      const hex = inp.value.replace(/^#/, "");
      update({ [key]: hex });
      const textInp = panel.querySelector(`input.cfg-color-hex[data-color-hex-key="${key}"]`);
      if (textInp) textInp.value = `#${hex}`;
    });
  });

  panel.querySelectorAll("input.cfg-color-hex[data-color-hex-key]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const key = inp.dataset.colorHexKey;
      if (!key) return;
      let v = inp.value.trim().replace(/^#/, "");
      if (v.length === 3) {
        v = v
          .split("")
          .map((c) => c + c)
          .join("");
      }
      if (v === "") {
        update({ [key]: "" });
        return;
      }
      if (!/^[0-9a-fA-F]{6}$/.test(v)) return;
      update({ [key]: v });
    });
  });
}
