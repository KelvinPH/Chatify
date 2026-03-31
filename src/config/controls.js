const DEFAULT_STATE = {
  platform: "twitch",
  channel: "",
  youtubeApiKey: "",
  youtubeChannelId: "",
  kickChannel: "",
  theme: "obsidian",
  layout: "floating",
  maxMessages: 50,
  showBadges: true,
  showPronouns: false,
  animateIn: "slide",
  fontSize: 14,
  transparent: false
};

let state = { ...DEFAULT_STATE };
let debounceTimer = null;

/** Build preview overlay URL (always includes demo=1). */
export function buildOverlayUrl(inputState) {
  const base = `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(inputState)) {
    if (typeof value === "boolean") {
      params.set(key, value ? "1" : "0");
    } else {
      params.set(key, String(value));
    }
  }

  params.set("demo", "1");
  return `${base}?${params.toString()}`;
}

/** Initialize configurator controls, state restore, and live preview wiring. */
export function initConfig() {
  loadPlatformState();
  renderSidebar();

  const initialUrl = buildOverlayUrl(state);
  const frame = document.getElementById("cfg-iframe");
  const urlDisplay = document.getElementById("cfg-url-display");
  if (frame) frame.src = initialUrl;
  if (urlDisplay) urlDisplay.textContent = initialUrl;

  const btnCopy = document.getElementById("btn-copy");
  const btnOpen = document.getElementById("btn-open");
  const btnReset = document.getElementById("btn-reset");

  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const url = buildFinalUrl(state);
      try {
        await navigator.clipboard.writeText(url);
        const prev = btnCopy.textContent;
        btnCopy.textContent = "Copied!";
        setTimeout(() => {
          btnCopy.textContent = prev;
        }, 1200);
      } catch (_e) {}
    });
  }

  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      window.open(buildFinalUrl(state), "_blank");
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      state = { ...DEFAULT_STATE };
      localStorage.removeItem("chatify_twitch");
      localStorage.removeItem("chatify_youtube");
      localStorage.removeItem("chatify_kick");
      update({});
    });
  }
}

function buildFinalUrl(inputState) {
  const base = `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(inputState)) {
    if (typeof value === "boolean") {
      params.set(key, value ? "1" : "0");
    } else {
      params.set(key, String(value));
    }
  }

  return `${base}?${params.toString()}`;
}

function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
  const scrollTop = sidebar.scrollTop;

  sidebar.innerHTML = `
  <div class="cfg-intro">
    <div class="cfg-intro-step">
      <span class="cfg-step-num">1</span>
      <div>
        <div class="cfg-step-title">Connect your chat</div>
        <div class="cfg-step-body">
          Choose a platform and enter your channel name below.
          No login required for basic chat display.
        </div>
      </div>
    </div>
    <div class="cfg-intro-step">
      <span class="cfg-step-num">2</span>
      <div>
        <div class="cfg-step-title">Design your overlay</div>
        <div class="cfg-step-body">
          Pick a theme, layout, and customise the look.
          The preview updates live.
        </div>
      </div>
    </div>
    <div class="cfg-intro-step">
      <span class="cfg-step-num">3</span>
      <div>
        <div class="cfg-step-title">Copy URL into OBS</div>
        <div class="cfg-step-body">
          Browser Source, any size that fits your layout.
          Recommended: 400 x 600 px.
        </div>
      </div>
    </div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Platform</div>
    <div class="cfg-btn-group">
      ${["twitch", "youtube", "kick"]
        .map(
          (p) => `
        <button class="cfg-btn cfg-platform-btn ${state.platform === p ? "cfg-active" : ""}"
                data-set-key="platform"
                data-set-value="${p}">
          <span class="cfg-platform-dot cfg-dot-${p}"></span>
          ${p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      `
        )
        .join("")}
    </div>
  </div>

  ${renderPlatformFields()}

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Layout</div>
    <div class="cfg-btn-group">
      ${["floating", "sidebar", "ticker"]
        .map(
          (l) => `
        <button class="cfg-btn ${state.layout === l ? "cfg-active" : ""}"
                data-set-key="layout" data-set-value="${l}">
          ${l}
        </button>
      `
        )
        .join("")}
    </div>
    <div class="cfg-layout-hint">${getLayoutHint(state.layout)}</div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Theme</div>
    <div class="cfg-theme-grid">
      ${["obsidian", "midnight", "aurora", "forest", "amber", "glass"]
        .map(
          (t) => `
        <button class="cfg-theme-btn ${state.theme === t ? "cfg-active" : ""}"
                data-set-key="theme" data-set-value="${t}">
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
    <div class="cfg-section-label">Options</div>
    ${toggleRow("Show badges", "showBadges", "Mod, VIP, sub badges next to usernames")}
    ${toggleRow("Show pronouns", "showPronouns", "Fetched from pronouns.alejo.io")}
    ${toggleRow("Transparent background", "transparent", "Remove background — use over gameplay")}

    <div class="cfg-slider-row">
      <span class="cfg-slider-label">Font size</span>
      <div class="cfg-slider-right">
        <input type="range" min="11" max="22" step="1"
               value="${state.fontSize}"
               data-range-key="fontSize" />
        <span class="cfg-slider-val" id="val-fontSize">
          ${state.fontSize}px
        </span>
      </div>
    </div>

    <div class="cfg-slider-row">
      <span class="cfg-slider-label">Max messages</span>
      <div class="cfg-slider-right">
        <input type="range" min="5" max="100" step="5"
               value="${state.maxMessages}"
               data-range-key="maxMessages" />
        <span class="cfg-slider-val" id="val-maxMessages">
          ${state.maxMessages}
        </span>
      </div>
    </div>

    <div class="cfg-select-row">
      <span class="cfg-select-label">Animate in</span>
      <select data-select-key="animateIn" class="cfg-select">
        ${["slide", "fade", "pop"]
          .map(
            (a) => `
          <option value="${a}" ${state.animateIn === a ? "selected" : ""}>
            ${a}
          </option>
        `
          )
          .join("")}
      </select>
    </div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">OBS setup</div>
    <div class="cfg-obs-tip">
      Add a Browser Source in OBS and paste the copied URL.
      Recommended size: <strong>400 x 600 px</strong> for floating layout,
      <strong>900 x 120 px</strong> for ticker.
      Transparent background works best over gameplay footage.
    </div>
  </div>
  `;

  sidebar.scrollTop = scrollTop;
  attachListeners(sidebar);
}

function renderPlatformFields() {
  if (state.platform === "twitch") {
    return `<div class="cfg-section">
      <input id="ctrl-channel" class="cfg-input" type="text"
             placeholder="Twitch channel name"
             value="${escCfg(state.channel)}" />
      ${state.channel ? '<div class="cfg-connected-badge">Connected</div>' : ""}
    </div>`;
  }

  if (state.platform === "youtube") {
    return `<div class="cfg-section">
      <input id="ctrl-youtubeChannelId" class="cfg-input cfg-input-sm"
             type="text" placeholder="YouTube Channel ID"
             value="${escCfg(state.youtubeChannelId)}" />
      <input id="ctrl-youtubeApiKey" class="cfg-input cfg-input-sm"
             type="text" placeholder="YouTube API Key (Google Cloud)"
             value="${escCfg(state.youtubeApiKey)}" />
      <div class="cfg-platform-info">
        Get a free API key at
        <a href="https://console.cloud.google.com"
           target="_blank" class="cfg-link">console.cloud.google.com</a>
        → Enable YouTube Data API v3 → Create credentials.
      </div>
    </div>`;
  }

  return `<div class="cfg-section">
    <input id="ctrl-kickChannel" class="cfg-input" type="text"
           placeholder="Kick channel name"
           value="${escCfg(state.kickChannel)}" />
    ${state.kickChannel ? '<div class="cfg-connected-badge">Connected</div>' : ""}
  </div>`;
}

function getLayoutHint(layout) {
  const hints = {
    floating: "Messages stack from the bottom. Classic chat position.",
    sidebar: "Fixed column, left or right side of screen.",
    ticker: "Single scrolling line across the bottom."
  };
  return `<p class="cfg-hint-text">${hints[layout] || ""}</p>`;
}

function toggleRow(label, key, description) {
  return `<label class="cfg-toggle-row">
    <span class="cfg-toggle-label-wrap">
      <span class="cfg-toggle-label">${label}</span>
      ${description ? `<span class="cfg-toggle-desc">${description}</span>` : ""}
    </span>
    <span class="cfg-toggle">
      <input type="checkbox" data-toggle-key="${key}" ${state[key] ? "checked" : ""} />
      <span class="cfg-toggle-track"></span>
      <span class="cfg-toggle-thumb"></span>
    </span>
  </label>`;
}

function update(newState) {
  Object.assign(state, newState);
  savePlatformState();
  const url = buildOverlayUrl(state);
  const frame = document.getElementById("cfg-iframe");
  const urlDisplay = document.getElementById("cfg-url-display");
  if (frame) frame.src = url;
  if (urlDisplay) urlDisplay.textContent = url;
  renderSidebar();
}

function savePlatformState() {
  localStorage.setItem("chatify_twitch", JSON.stringify({ channel: state.channel }));
  localStorage.setItem(
    "chatify_youtube",
    JSON.stringify({
      channelId: state.youtubeChannelId,
      apiKey: state.youtubeApiKey
    })
  );
  localStorage.setItem("chatify_kick", JSON.stringify({ channel: state.kickChannel }));
}

function loadPlatformState() {
  try {
    const tw = JSON.parse(localStorage.getItem("chatify_twitch") || "{}");
    state.channel = tw.channel || "";

    const yt = JSON.parse(localStorage.getItem("chatify_youtube") || "{}");
    state.youtubeChannelId = yt.channelId || "";
    state.youtubeApiKey = yt.apiKey || "";

    const ki = JSON.parse(localStorage.getItem("chatify_kick") || "{}");
    state.kickChannel = ki.channel || "";
  } catch (_e) {}
}

function attachListeners(sidebar) {
  sidebar.querySelectorAll("[data-set-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      update({ [btn.dataset.setKey]: btn.dataset.setValue });
    });
  });

  sidebar.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", () => {
      update({ [input.dataset.toggleKey]: input.checked });
    });
  });

  sidebar.querySelectorAll("[data-range-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.rangeKey;
      const val = Number(input.value);
      const label = document.getElementById(`val-${key}`);
      if (label) {
        label.textContent = key === "fontSize" ? `${val}px` : String(val);
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => update({ [key]: val }), 300);
    });
  });

  sidebar.querySelectorAll("[data-select-key]").forEach((sel) => {
    sel.addEventListener("change", () => {
      update({ [sel.dataset.selectKey]: sel.value });
    });
  });

  const mapping = {
    "ctrl-channel": "channel",
    "ctrl-youtubeChannelId": "youtubeChannelId",
    "ctrl-youtubeApiKey": "youtubeApiKey",
    "ctrl-kickChannel": "kickChannel"
  };

  Object.entries(mapping).forEach(([id, stateKey]) => {
    const input = sidebar.querySelector(`#${id}`);
    if (!input) return;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        update({ [stateKey]: input.value.trim() });
      }, 600);
    });
  });
}

function escCfg(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
