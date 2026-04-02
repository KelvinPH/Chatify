import {
  renderCustomPanel as mountCustomPanel,
  attachCustomPanelListeners
} from "./custom-editor.js";

const DEFAULT_STATE = {
  twitchEnabled: false,
  twitchChannel: "",
  youtubeEnabled: false,
  youtubeApiKey: "",
  youtubeChannelId: "",
  kickEnabled: false,
  kickChannel: "",
  tiktokEnabled: false,
  tiktokUniqueId: "",
  tiktokApiKey: "",
  theme: "obsidian",
  layout: "default",
  maxMessages: 50,
  showBadges: true,
  showPronouns: false,
  animateIn: "slide",
  transparent: false,
  useUsernameColor: true,
  showTimestamp: false,
  compactMode: false,
  fontSize: 14,
  fontFamily: "system",
  fontWeight: "400",
  msgPadding: 8,
  msgRadius: 12,
  msgOpacity: 85,
  msgMaxWidth: 500,
  badgeSize: 18,
  emoteSize: 24,
  tickerSpeed: 20,
  showPlatformTag: false,
  platformTintMessages: false,
  customTextColor: "",
  customMutedColor: "",
  customMsgBgColor: "",
  customAccentColor: ""
};

const PRESETS = [
  {
    name: "classic",
    label: "Classic",
    desc: "Glass card, clean look",
    state: {
      theme: "obsidian",
      transparent: false,
      msgOpacity: 85,
      msgRadius: 12,
      fontWeight: "400",
      compactMode: false
    }
  },
  {
    name: "minimal",
    label: "Minimal",
    desc: "No background, text only",
    state: {
      theme: "obsidian",
      transparent: true,
      msgOpacity: 0,
      msgRadius: 0,
      fontWeight: "400"
    }
  },
  {
    name: "bold",
    label: "Bold",
    desc: "Solid dark, strong contrast",
    state: {
      theme: "midnight",
      transparent: false,
      msgOpacity: 100,
      msgRadius: 8,
      fontWeight: "600"
    }
  },
  {
    name: "soft",
    label: "Soft",
    desc: "Low opacity glass, muted",
    state: {
      theme: "glass",
      transparent: true,
      msgOpacity: 25,
      msgRadius: 16,
      fontWeight: "400"
    }
  },
  {
    name: "compact",
    label: "Compact",
    desc: "Dense layout, small font",
    state: {
      theme: "obsidian",
      compactMode: true,
      msgPadding: 4,
      fontSize: 12,
      msgRadius: 6
    }
  }
];

let state = { ...DEFAULT_STATE };
let debounceTimer = null;

function normalizeLayoutValue(layout) {
  if (layout === "floating") return "default";
  if (layout === "ticker") return "bar";
  return layout || "default";
}
let customPanelOpen = false;
let activeCustomTab = "typography";
const expandedPlatforms = {
  twitch: false,
  youtube: false,
  kick: false,
  tiktok: false
};

function hasConfiguredChannel(inputState) {
  return (
    (inputState.twitchEnabled && Boolean(inputState.twitchChannel)) ||
    (inputState.youtubeEnabled && Boolean(inputState.youtubeChannelId)) ||
    (inputState.kickEnabled && Boolean(inputState.kickChannel)) ||
    (inputState.tiktokEnabled &&
      Boolean(inputState.tiktokUniqueId) &&
      Boolean(inputState.tiktokApiKey))
  );
}

/** Build preview URL for iframe (adds demo when no enabled platform with credentials). */
export function buildOverlayUrl(inputState) {
  const base = `${window.location.origin}${window.location.pathname.replace(
    "config.html",
    ""
  )}overlay.html`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(inputState)) {
    if (typeof value === "boolean") params.set(key, value ? "1" : "0");
    else if (value === "" || value == null) continue;
    else params.set(key, String(value));
  }

  if (!hasConfiguredChannel(inputState)) params.set("demo", "1");

  return `${base}?${params.toString()}`;
}

/** Initialize configurator controls and preview. */
export function initConfig() {
  loadPlatformState();
  state.layout = normalizeLayoutValue(state.layout);
  renderSidebar();
  updatePreview();

  const btnCopy = document.getElementById("btn-copy");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(buildFinalUrl(state));
        const prev = btnCopy.textContent;
        btnCopy.textContent = "Copied!";
        setTimeout(() => {
          btnCopy.textContent = prev;
        }, 1200);
      } catch (_e) {}
    });
  }

  const btnOpen = document.getElementById("btn-open");
  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      window.open(buildFinalUrl(state), "_blank");
    });
  }

  const btnReset = document.getElementById("btn-reset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      state = { ...DEFAULT_STATE };
      localStorage.removeItem("chatify_twitch");
      localStorage.removeItem("chatify_youtube");
      localStorage.removeItem("chatify_kick");
      localStorage.removeItem("chatify_tiktok");
      customPanelOpen = false;
      expandedPlatforms.twitch = false;
      expandedPlatforms.youtube = false;
      expandedPlatforms.kick = false;
      expandedPlatforms.tiktok = false;
      update({});
    });
  }
}

function buildFinalUrl(inputState) {
  const base = `${window.location.origin}${window.location.pathname.replace(
    "config.html",
    ""
  )}overlay.html`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(inputState)) {
    if (typeof value === "boolean") params.set(key, value ? "1" : "0");
    else if (value === "" || value == null) continue;
    else params.set(key, String(value));
  }

  return `${base}?${params.toString()}`;
}

function update(newState) {
  const next = { ...newState };
  if (next.layout != null) next.layout = normalizeLayoutValue(next.layout);
  Object.assign(state, next);
  savePlatformState();
  updatePreview();
  if (customPanelOpen) renderCustomPanel();
  else renderSidebar();
}

function updatePreview() {
  const url = buildOverlayUrl(state);
  const frame = document.getElementById("cfg-iframe");
  const display = document.getElementById("cfg-url-display");
  if (frame) frame.src = url;
  if (display) display.textContent = url;
}

function formatRangeLabel(key, val) {
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
}

function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
  const scrollTop = sidebar.scrollTop;
  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";

  const panel = document.getElementById("cfg-custom-panel");
  if (panel) panel.classList.remove("cfg-panel-open");

  sidebar.innerHTML = `
    ${renderIntro()}

    <div class="cfg-divider"></div>

    <div class="cfg-section">
      <div class="cfg-section-label">Platforms</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${renderPlatformBlock("twitch")}
        ${renderPlatformBlock("youtube")}
        ${renderPlatformBlock("kick")}
        ${renderPlatformBlock("tiktok")}
      </div>
      <div class="cfg-platform-info">
        Enable one or more platforms. All connected platforms
        appear in the same chat feed with a colored dot
        showing the source. TikTok LIVE uses a free API key from
        <a href="https://tik.tools" target="_blank" class="cfg-link">tik.tools</a>
        (WebSocket relay).
      </div>
    </div>

    <div class="cfg-divider"></div>

    <div class="cfg-section">
      <div class="cfg-section-label">Layout</div>
      <div class="cfg-btn-group">
        ${[
          ["default", "Default"],
          ["bar", "Scroll bar"],
          ["sidebar", "Sidebar"]
        ]
          .map(
            ([l, label]) => `
          <button type="button" class="cfg-btn cfg-sm-btn ${
            state.layout === l ? "cfg-active" : ""
          }" data-set-key="layout" data-set-value="${l}">
            ${label}
          </button>
        `
          )
          .join("")}
      </div>
      ${getLayoutHint(state.layout)}
    </div>

    <div class="cfg-divider"></div>

    <div class="cfg-section">
      <div class="cfg-section-label">Theme</div>
      <div class="cfg-theme-grid">
        ${["obsidian", "midnight", "aurora", "forest", "amber", "glass"]
          .map(
            (t) => `
          <button type="button" class="cfg-theme-btn ${
            state.theme === t ? "cfg-active" : ""
          }" data-set-key="theme" data-set-value="${t}">
            <div class="cfg-theme-dot cfg-theme-dot-${t}"></div>
            <span>${t}</span>
          </button>
        `
          )
          .join("")}
      </div>
    </div>

    <div class="cfg-divider"></div>

    <div class="cfg-section">
      <div class="cfg-section-label">Presets</div>
      <div class="cfg-preset-grid">
        ${PRESETS.map(
          (p) => `
          <button type="button" class="cfg-preset-btn" data-preset="${p.name}">
            <span class="cfg-preset-name">${p.label}</span>
            <span class="cfg-preset-desc">${p.desc}</span>
          </button>
        `
        ).join("")}
      </div>
    </div>

    <div class="cfg-divider"></div>

    <div class="cfg-section">
      <div class="cfg-section-label">Options</div>
      ${toggleRow("Show badges", "showBadges", "Mod, VIP, sub badges")}
      ${toggleRow("Show pronouns", "showPronouns", "From pronouns.alejo.io")}
      ${toggleRow("Transparent bg", "transparent", "")}
      ${toggleRow("Use chat colors", "useUsernameColor", "Platform username colors")}
      ${toggleRow(
        "Platform tint",
        "platformTintMessages",
        "Twitch purple, YouTube red, Kick green accent on each card"
      )}
      ${toggleRow("Platform label", "showPlatformTag", "TWITCH / YOUTUBE / KICK pill on each message")}
      ${toggleRow("Show timestamp", "showTimestamp", "Time each message was sent")}
      ${toggleRow("Compact mode", "compactMode", "Tighter spacing, smaller font")}
      ${sliderRow("Max messages", "maxMessages", 5, 100, 5, state.maxMessages)}
      <div class="cfg-select-row">
        <span class="cfg-select-label">Animate in</span>
        <select data-select-key="animateIn" class="cfg-select">
          ${[
            ["slide", "Slide up"],
            ["fade", "Fade"],
            ["pop", "Pop"],
            ["left", "Slide left"],
            ["none", "None"]
          ]
            .map(
              ([v, l]) => `
            <option value="${v}" ${state.animateIn === v ? "selected" : ""}>
              ${l}
            </option>
          `
            )
            .join("")}
        </select>
      </div>
    </div>

    <div class="cfg-divider"></div>

    <div class="cfg-section">
      <div class="cfg-section-label">Custom</div>
      <button type="button" class="cfg-custom-enter-btn" id="btn-open-custom">
        Open custom editor
        <span style="opacity:0.4">→</span>
      </button>
    </div>

    <div class="cfg-divider"></div>

    <div class="cfg-section">
      <div class="cfg-section-label">OBS</div>
      <div class="cfg-obs-tip">
        Browser Source → paste URL.
        <strong>400 x 600</strong> for default layout,
        <strong>900 x 80</strong> for scroll bar.
      </div>
    </div>
  `;

  sidebar.scrollTop = scrollTop;
  attachSidebarListeners(sidebar);
}

function renderCustomPanel() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (sidebar) sidebar.style.display = "none";

  const panel = document.getElementById("cfg-custom-panel");
  if (!panel) return;
  panel.classList.add("cfg-panel-open");

  mountCustomPanel(panel, state, activeCustomTab, { sliderRow, toggleRow });
  attachCustomPanelListeners(panel, {
    update,
    onBack: () => {
      customPanelOpen = false;
      renderSidebar();
    },
    onTabChange: (tab) => {
      activeCustomTab = tab;
      renderCustomPanel();
    },
    debounce: (fn, ms) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fn, ms);
    }
  });
}

function renderPlatformBlock(platform) {
  const isOpen = expandedPlatforms[platform];
  const isEnabled = state[`${platform}Enabled`];
  const labels = {
    twitch: "Twitch",
    youtube: "YouTube",
    kick: "Kick",
    tiktok: "TikTok"
  };
  return `
  <div class="cfg-platform-block ${isOpen ? "cfg-platform-open" : ""}"
       data-platform="${platform}">
    <div class="cfg-platform-header" data-toggle-platform="${platform}">
      <div class="cfg-platform-header-left">
        <div class="cfg-platform-dot-sm cfg-dot-${platform}"></div>
        <span class="cfg-platform-name">${labels[platform]}</span>
      </div>
      <div class="cfg-platform-header-right">
        ${isEnabled ? '<span class="cfg-connected-badge">On</span>' : ""}
        <span class="cfg-platform-chevron">▼</span>
      </div>
    </div>
    <div class="cfg-platform-body">
      ${toggleRow(`Enable ${labels[platform]}`, `${platform}Enabled`, "")}
      ${renderPlatformFields(platform)}
    </div>
  </div>`;
}

function renderPlatformFields(platform) {
  if (platform === "twitch") {
    return `<input id="ctrl-twitchChannel" class="cfg-input"
           type="text" placeholder="Channel name"
           value="${escCfg(state.twitchChannel)}" />`;
  }
  if (platform === "youtube") {
    return `
    <input id="ctrl-youtubeChannelId" class="cfg-input"
           type="text" placeholder="Channel ID"
           value="${escCfg(state.youtubeChannelId)}" />
    <input id="ctrl-youtubeApiKey" class="cfg-input"
           type="text" placeholder="YouTube API Key"
           value="${escCfg(state.youtubeApiKey)}" />
    <div class="cfg-platform-info">
      Get a free API key at
      <a href="https://console.cloud.google.com"
         target="_blank" class="cfg-link">
        console.cloud.google.com
      </a>
      → Enable YouTube Data API v3.
    </div>`;
  }
  if (platform === "kick") {
    return `<input id="ctrl-kickChannel" class="cfg-input"
         type="text" placeholder="Channel name"
         value="${escCfg(state.kickChannel)}" />`;
  }
  if (platform === "tiktok") {
    return `
    <input id="ctrl-tiktokUniqueId" class="cfg-input"
           type="text" placeholder="TikTok username (no @)"
           value="${escCfg(state.tiktokUniqueId)}" />
    <input id="ctrl-tiktokApiKey" class="cfg-input"
           type="password" autocomplete="off"
           placeholder="TikTool API key"
           value="${escCfg(state.tiktokApiKey)}" />
    <div class="cfg-platform-info">
      Get a free key at
      <a href="https://tik.tools" target="_blank" class="cfg-link">tik.tools</a>
      → connect to
      <code style="font-size:10px;opacity:0.85">wss://api.tik.tools</code>
      for LIVE chat while the stream is live.
    </div>`;
  }
  return "";
}

function attachSidebarListeners(sidebar) {
  sidebar.querySelectorAll("[data-set-key]").forEach((btn) => {
    btn.addEventListener("click", () =>
      update({ [btn.dataset.setKey]: btn.dataset.setValue })
    );
  });

  sidebar.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", () =>
      update({ [input.dataset.toggleKey]: input.checked })
    );
  });

  sidebar.querySelectorAll("[data-range-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.rangeKey;
      const val = Number(input.value);
      const label = document.getElementById(`val-${key}`);
      if (label && key) label.textContent = formatRangeLabel(key, val);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => update({ [key]: val }), 300);
    });
  });

  sidebar.querySelectorAll("[data-select-key]").forEach((sel) => {
    sel.addEventListener("change", () =>
      update({ [sel.dataset.selectKey]: sel.value })
    );
  });

  const inputMap = {
    "ctrl-twitchChannel": "twitchChannel",
    "ctrl-youtubeChannelId": "youtubeChannelId",
    "ctrl-youtubeApiKey": "youtubeApiKey",
    "ctrl-kickChannel": "kickChannel",
    "ctrl-tiktokUniqueId": "tiktokUniqueId",
    "ctrl-tiktokApiKey": "tiktokApiKey"
  };
  Object.entries(inputMap).forEach(([id, key]) => {
    const el = sidebar.querySelector(`#${id}`);
    if (!el) return;
    el.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        let v = el.value.trim();
        if (key === "tiktokUniqueId") v = v.replace(/^@/, "");
        update({ [key]: v });
      }, 600);
    });
  });

  sidebar.querySelectorAll("[data-toggle-platform]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = el.dataset.togglePlatform;
      if (p) expandedPlatforms[p] = !expandedPlatforms[p];
      renderSidebar();
    });
  });

  sidebar.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = PRESETS.find((p) => p.name === btn.dataset.preset);
      if (preset) update({ ...preset.state });
    });
  });

  const btnCustom = sidebar.querySelector("#btn-open-custom");
  if (btnCustom) {
    btnCustom.addEventListener("click", () => {
      customPanelOpen = true;
      activeCustomTab = "typography";
      renderCustomPanel();
    });
  }
}

function renderIntro() {
  return `
    <div class="cfg-intro">
      <div class="cfg-intro-step">
        <span class="cfg-step-num">1</span>
        <div>
          <div class="cfg-step-title">Connect your chat</div>
          <div class="cfg-step-body">
            Enable one or more platforms and add credentials.
          </div>
        </div>
      </div>
      <div class="cfg-intro-step">
        <span class="cfg-step-num">2</span>
        <div>
          <div class="cfg-step-title">Style your overlay</div>
          <div class="cfg-step-body">
            Themes, presets, or the custom editor.
          </div>
        </div>
      </div>
      <div class="cfg-intro-step">
        <span class="cfg-step-num">3</span>
        <div>
          <div class="cfg-step-title">Copy URL into OBS</div>
          <div class="cfg-step-body">
            Paste into Browser Source and go live.
          </div>
        </div>
      </div>
    </div>
  `;
}

function getLayoutHint(layout) {
  const hints = {
    default: "Messages stack from the bottom. Classic chat position.",
    floating: "Messages stack from the bottom. Classic chat position.",
    sidebar: "Fixed column, top to bottom.",
    bar: "Single horizontal line that scrolls continuously.",
    ticker: "Single horizontal line that scrolls continuously."
  };
  return `<p class="cfg-hint-text">${hints[layout] || hints.default}</p>`;
}

function toggleRow(label, key, description) {
  return `<label class="cfg-toggle-row">
    <span class="cfg-toggle-label-wrap">
      <span class="cfg-toggle-label">${label}</span>
      ${
        description ? `<span class="cfg-toggle-desc">${description}</span>` : ""
      }
    </span>
    <span class="cfg-toggle">
      <input type="checkbox" data-toggle-key="${key}" ${
    state[key] ? "checked" : ""
  } />
      <span class="cfg-toggle-track"></span>
      <span class="cfg-toggle-thumb"></span>
    </span>
  </label>`;
}

function sliderRow(label, key, min, max, step, value) {
  return `
    <div class="cfg-slider-row">
      <span class="cfg-slider-label">${label}</span>
      <div class="cfg-slider-right">
        <input type="range"
               min="${min}" max="${max}" step="${step}"
               value="${value}"
               data-range-key="${key}" />
        <span class="cfg-slider-val" id="val-${key}">
          ${formatRangeLabel(key, value)}
        </span>
      </div>
    </div>
  `;
}

function savePlatformState() {
  localStorage.setItem(
    "chatify_twitch",
    JSON.stringify({
      channel: state.twitchChannel,
      enabled: state.twitchEnabled
    })
  );
  localStorage.setItem(
    "chatify_youtube",
    JSON.stringify({
      channelId: state.youtubeChannelId,
      apiKey: state.youtubeApiKey,
      enabled: state.youtubeEnabled
    })
  );
  localStorage.setItem(
    "chatify_kick",
    JSON.stringify({
      channel: state.kickChannel,
      enabled: state.kickEnabled
    })
  );
  localStorage.setItem(
    "chatify_tiktok",
    JSON.stringify({
      uniqueId: state.tiktokUniqueId,
      apiKey: state.tiktokApiKey,
      enabled: state.tiktokEnabled
    })
  );
}

function loadPlatformState() {
  try {
    const tw = JSON.parse(localStorage.getItem("chatify_twitch") || "{}");
    state.twitchChannel = tw.channel || "";
    if (typeof tw.enabled === "boolean") state.twitchEnabled = tw.enabled;
    else state.twitchEnabled = Boolean(state.twitchChannel);

    const yt = JSON.parse(localStorage.getItem("chatify_youtube") || "{}");
    state.youtubeChannelId = yt.channelId || "";
    state.youtubeApiKey = yt.apiKey || "";
    if (typeof yt.enabled === "boolean") state.youtubeEnabled = yt.enabled;
    else state.youtubeEnabled = Boolean(state.youtubeChannelId && state.youtubeApiKey);

    const ki = JSON.parse(localStorage.getItem("chatify_kick") || "{}");
    state.kickChannel = ki.channel || "";
    if (typeof ki.enabled === "boolean") state.kickEnabled = ki.enabled;
    else state.kickEnabled = Boolean(state.kickChannel);

    const tt = JSON.parse(localStorage.getItem("chatify_tiktok") || "{}");
    state.tiktokUniqueId = tt.uniqueId || "";
    state.tiktokApiKey = tt.apiKey || "";
    if (typeof tt.enabled === "boolean") state.tiktokEnabled = tt.enabled;
    else state.tiktokEnabled = Boolean(state.tiktokUniqueId && state.tiktokApiKey);
  } catch (_e) {}
}

function escCfg(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
