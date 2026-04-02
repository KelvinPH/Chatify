import * as TwitchPlatform from "../platforms/twitch.js";
import * as YouTubePlatform from "../platforms/youtube.js";
import * as KickPlatform from "../platforms/kick.js";
import * as TikTokPlatform from "../platforms/tiktok.js";
import * as BTTVEmotes from "../emotes/bttv.js";
import * as FFZEmotes from "../emotes/ffz.js";
import * as SevenTVEmotes from "../emotes/seventv.js";
import { extractTwitchEmotes } from "../emotes/twitch.js";
import { buildEmoteMap, parseMessage, tokensToHtml } from "../emotes/parser.js";
import { badgesToHtml } from "../badges/renderer.js";
import * as TwitchBadges from "../badges/twitch.js";
import { fetchPronounList, getPronouns } from "../pronouns/alejo.js";
import * as Queue from "./queue.js";
import { buildDemoMessages } from "./demo.js";
import { renderEvent } from "./events.js";

let config = {};
let emoteMap = {};
let badgeData = {};
let demoTimer = null;

function normalizeLayoutParam(value) {
  const v = String(value || "").toLowerCase();
  if (v === "floating" || v === "default" || v === "") return "default";
  if (v === "ticker" || v === "bar") return "bar";
  if (v === "sidebar") return "sidebar";
  return "default";
}

function layoutIsBar(layout) {
  return layout === "bar" || layout === "ticker";
}

function hexToRgbTriplet(hex) {
  const h = String(hex || "").replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

/** Parse overlay URL parameters into normalized chat config. */
export function parseConfig() {
  const params = new URLSearchParams(window.location.search);
  const toBool = (v, fallback) => {
    if (v === null) return fallback;
    return v === "1" || v === "true";
  };

  const legacyPlatform = params.get("platform") || "";
  const legacyChannel = params.get("channel") || "";
  let twitchEnabled = params.get("twitchEnabled") === "1";
  let twitchChannel = params.get("twitchChannel") || "";
  let kickEnabled = params.get("kickEnabled") === "1";
  let kickChannel = params.get("kickChannel") || "";
  if (!params.has("twitchEnabled") && !twitchChannel && legacyChannel) {
    if (legacyPlatform === "twitch" || legacyPlatform === "") {
      twitchChannel = legacyChannel;
      twitchEnabled = true;
    }
    if (legacyPlatform === "kick") {
      kickChannel = legacyChannel;
      kickEnabled = true;
    }
  }

  return {
    twitchEnabled,
    twitchChannel,
    youtubeEnabled: params.get("youtubeEnabled") === "1",
    youtubeApiKey: params.get("youtubeApiKey") || "",
    youtubeChannelId: params.get("youtubeChannelId") || "",
    kickEnabled,
    kickChannel,
    tiktokEnabled: params.get("tiktokEnabled") === "1",
    tiktokUniqueId: (params.get("tiktokUniqueId") || "").replace(/^@/, "").trim(),
    tiktokApiKey: params.get("tiktokApiKey") || "",
    theme: params.get("theme") || "obsidian",
    layout: normalizeLayoutParam(params.get("layout")),
    maxMessages: Number(params.get("maxMessages")) || 50,
    showBadges: toBool(params.get("showBadges"), true),
    showPronouns: toBool(params.get("showPronouns"), false),
    animateIn: params.get("animateIn") || "slide",
    animateOut: params.get("animateOut") || "fade",
    fontSize: Number(params.get("fontSize")) || 14,
    fontFamily: params.get("fontFamily") || "system",
    fontWeight: params.get("fontWeight") || "400",
    msgPadding: Number(params.get("msgPadding")) || 8,
    msgRadius: Number(params.get("msgRadius")) || 12,
    msgOpacity: Number(params.get("msgOpacity")) || 85,
    msgMaxWidth: Number(params.get("msgMaxWidth")) || 500,
    tickerSpeed: Number(params.get("tickerSpeed")) || 20,
    emoteSize: Number(params.get("emoteSize")) || 24,
    badgeSize: Number(params.get("badgeSize")) || 18,
    useUsernameColor: params.get("useUsernameColor") !== "0",
    showTimestamp: toBool(params.get("showTimestamp"), false),
    compactMode: toBool(params.get("compactMode"), false),
    transparent: toBool(params.get("transparent"), false),
    demo: toBool(params.get("demo"), false),
    showPlatformTag: toBool(params.get("showPlatformTag"), false),
    platformTintMessages: toBool(params.get("platformTintMessages"), false),
    customTextColor: (params.get("customTextColor") || "").replace(/^#/, ""),
    customMutedColor: (params.get("customMutedColor") || "").replace(/^#/, ""),
    customMsgBgColor: (params.get("customMsgBgColor") || "").replace(/^#/, ""),
    customAccentColor: (params.get("customAccentColor") || "").replace(/^#/, "")
  };
}

async function connectPlatforms(cfg) {
  const callbacks = {
    onMessage: (msg) => {
      try {
        handleMessage(msg);
      } catch (e) {
        console.warn("onMessage failed", e);
      }
    },
    onEvent: (msg) => {
      try {
        handleEvent(msg);
      } catch (e) {
        console.warn("onEvent failed", e);
      }
    }
  };

  const connections = [];

  if (cfg.twitchEnabled && cfg.twitchChannel) {
    connections.push(
      Promise.resolve().then(() =>
        TwitchPlatform.connect({
          channel: cfg.twitchChannel,
          ...callbacks
        })
      )
    );
    connections.push(
      BTTVEmotes.fetchChannel(cfg.twitchChannel),
      FFZEmotes.fetchChannel(cfg.twitchChannel),
      SevenTVEmotes.fetchChannel(cfg.twitchChannel)
    );
  }

  if (cfg.youtubeEnabled && cfg.youtubeApiKey && cfg.youtubeChannelId) {
    connections.push(
      YouTubePlatform.connect({
        channelId: cfg.youtubeChannelId,
        apiKey: cfg.youtubeApiKey,
        ...callbacks
      })
    );
  }

  if (cfg.kickEnabled && cfg.kickChannel) {
    connections.push(KickPlatform.connect({ channel: cfg.kickChannel, ...callbacks }));
  }

  if (cfg.tiktokEnabled && cfg.tiktokUniqueId && cfg.tiktokApiKey) {
    connections.push(
      Promise.resolve().then(() =>
        TikTokPlatform.connect({
          uniqueId: cfg.tiktokUniqueId,
          apiKey: cfg.tiktokApiKey,
          ...callbacks
        })
      )
    );
  }

  await Promise.allSettled(connections);

  emoteMap = buildEmoteMap(
    BTTVEmotes.getEmotes(),
    FFZEmotes.getEmotes(),
    SevenTVEmotes.getEmotes()
  );
  badgeData = TwitchBadges.getAll();
}

/** Initialize chat rendering pipeline and connect enabled platforms. */
export async function init() {
  config = parseConfig();
  const app = document.getElementById("app");

  document.documentElement.classList.remove(
    "ch-compact",
    "ch-timestamps",
    "ch-platform-tint"
  );
  document.documentElement.setAttribute("data-theme", config.theme);
  document.documentElement.setAttribute("data-animate", config.animateIn || "slide");
  if (app) app.setAttribute("data-layout", config.layout);

  if (config.platformTintMessages) {
    document.documentElement.classList.add("ch-platform-tint");
  }

  const fonts = {
    system: "-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
    inter: "'Inter','Helvetica Neue',sans-serif",
    mono: "'SF Mono','Fira Code',monospace",
    serif: "'Georgia','Times New Roman',serif"
  };
  document.documentElement.style.setProperty(
    "--ch-font",
    fonts[config.fontFamily] || fonts.system
  );
  document.documentElement.style.setProperty("--ch-font-weight", config.fontWeight || "400");
  document.documentElement.style.setProperty(
    "--ch-font-size",
    `${config.fontSize || 14}px`
  );
  document.documentElement.style.setProperty(
    "--ch-emote-size",
    `${config.emoteSize || 24}px`
  );
  document.documentElement.style.setProperty(
    "--ch-badge-size",
    `${config.badgeSize || 18}px`
  );
  document.documentElement.style.setProperty(
    "--ch-msg-padding",
    `${config.msgPadding || 8}px ${(config.msgPadding || 8) + 4}px`
  );
  document.documentElement.style.setProperty(
    "--ch-msg-radius",
    `${config.msgRadius || 12}px`
  );
  document.documentElement.style.setProperty(
    "--ch-msg-max-width",
    `${config.msgMaxWidth || 500}px`
  );
  document.documentElement.style.setProperty(
    "--ch-ticker-speed",
    `${config.tickerSpeed || 20}s`
  );

  const opacity = (config.msgOpacity || 85) / 100;
  document.documentElement.style.setProperty("--ch-msg-opacity", String(opacity));

  document.documentElement.style.removeProperty("--ch-text");
  document.documentElement.style.removeProperty("--ch-text-muted");
  document.documentElement.style.removeProperty("--ch-accent");
  document.documentElement.style.removeProperty("--ch-msg-fill-r");
  document.documentElement.style.removeProperty("--ch-msg-fill-g");
  document.documentElement.style.removeProperty("--ch-msg-fill-b");

  const textHex = hexToRgbTriplet(config.customTextColor);
  if (textHex) {
    document.documentElement.style.setProperty(
      "--ch-text",
      `rgb(${textHex.r},${textHex.g},${textHex.b})`
    );
  }

  const mutedHex = hexToRgbTriplet(config.customMutedColor);
  if (mutedHex) {
    document.documentElement.style.setProperty(
      "--ch-text-muted",
      `rgba(${mutedHex.r},${mutedHex.g},${mutedHex.b},0.55)`
    );
  }

  const accentHex = hexToRgbTriplet(config.customAccentColor);
  if (accentHex) {
    document.documentElement.style.setProperty(
      "--ch-accent",
      `rgb(${accentHex.r},${accentHex.g},${accentHex.b})`
    );
  }

  const bgHex = hexToRgbTriplet(config.customMsgBgColor);
  if (bgHex) {
    document.documentElement.style.setProperty("--ch-msg-fill-r", String(bgHex.r));
    document.documentElement.style.setProperty("--ch-msg-fill-g", String(bgHex.g));
    document.documentElement.style.setProperty("--ch-msg-fill-b", String(bgHex.b));
  }

  if (config.compactMode) {
    document.documentElement.classList.add("ch-compact");
  }

  if (config.showTimestamp) {
    document.documentElement.classList.add("ch-timestamps");
  }

  if (config.transparent) {
    document.body.style.background = "transparent";
    document.documentElement.style.setProperty("--ch-bg", "transparent");
    document.documentElement.style.setProperty("--ch-glass", "rgba(255,255,255,0.04)");
  }

  Queue.init({
    max: config.maxMessages,
    onUpdate: renderMessages
  });

  const hasChannel =
    (config.twitchEnabled && config.twitchChannel) ||
    (config.youtubeEnabled && config.youtubeChannelId) ||
    (config.kickEnabled && config.kickChannel) ||
    (config.tiktokEnabled && config.tiktokUniqueId && config.tiktokApiKey);

  if (config.demo || !hasChannel) {
    startDemo();
    return;
  }

  if (config.showPronouns) {
    await fetchPronounList();
  }

  await Promise.allSettled([BTTVEmotes.fetchGlobal(), SevenTVEmotes.fetchGlobal()]);
  emoteMap = buildEmoteMap(
    BTTVEmotes.getEmotes(),
    FFZEmotes.getEmotes(),
    SevenTVEmotes.getEmotes()
  );

  try {
    await connectPlatforms(config);
  } catch (e) {
    console.warn("connectPlatforms failed.", e);
  }

  window.addEventListener("chatify:delete", (e) => {
    Queue.remove(e?.detail?.id);
  });
  window.addEventListener("chatify:timeout", (e) => {
    Queue.removeByUsername(e?.detail?.username);
  });
  window.addEventListener("chatify:clear", () => {
    Queue.clear();
  });
}

async function handleMessage(msg) {
  if (demoTimer) {
    clearTimeout(demoTimer);
    demoTimer = null;
    Queue.clear();
  }

  const pronouns = config.showPronouns ? await getPronouns(msg.username) : null;
  let tokens = [];

  if (msg.platform === "twitch" && msg.emotes && Object.keys(msg.emotes).length > 0) {
    const twitchTokens = extractTwitchEmotes(msg.message, msg.emotes);
    tokens = [];
    for (const token of twitchTokens) {
      if (token.type === "text") {
        tokens.push(...parseMessage(token.content, emoteMap));
      } else {
        tokens.push(token);
      }
    }
  } else {
    tokens = parseMessage(msg.message, emoteMap);
  }

  const messageHtml = tokensToHtml(tokens);
  const badgeHtml = config.showBadges ? badgesToHtml(msg.badges, badgeData) : "";

  Queue.add({
    ...msg,
    renderedBadges: badgeHtml,
    renderedMessage: messageHtml,
    pronouns: pronouns || null
  });
}

function handleEvent(msg) {
  renderEvent(msg);
}

function renderMessages(messages) {
  try {
    const app = document.getElementById("app");
    if (!app) return;
    if (layoutIsBar(config.layout)) {
      renderTicker(app, messages);
      return;
    }

    app.innerHTML = messages.map((msg) => renderMessageHtml(msg)).join("");
  } catch (error) {
    console.warn("renderMessages failed.", error);
  }
}

function renderTicker(app, messages) {
  const existing = app.querySelector(".ch-ticker-track");
  if (existing) existing.remove();

  if (!messages.length) return;

  const track = document.createElement("div");
  track.className = "ch-ticker-track";
  const buildSegment = () => {
    const fragment = document.createDocumentFragment();
    messages.forEach((msg, i) => {
      const item = document.createElement("div");
      item.className = "ch-ticker-item";
      item.innerHTML = `
        ${platformTagHtml(msg)}
        ${msg.renderedBadges || ""}
        <span class="ch-username" style="color:${usernameColor(msg)}">
          ${escHtml(msg.username)}
        </span>
        <span style="color:var(--ch-text-muted);margin:0 2px">·</span>
        <span class="ch-msg-body">${msg.renderedMessage}</span>
      `;
      fragment.appendChild(item);

      if (i < messages.length - 1) {
        const sep = document.createElement("span");
        sep.className = "ch-ticker-sep";
        sep.textContent = "·";
        fragment.appendChild(sep);
      }
    });
    return fragment;
  };

  track.appendChild(buildSegment());
  const segmentBreak = document.createElement("span");
  segmentBreak.className = "ch-ticker-sep";
  segmentBreak.textContent = "·";
  track.appendChild(segmentBreak);
  track.appendChild(buildSegment());

  app.appendChild(track);
}

function platformTagHtml(msg) {
  if (!config.showPlatformTag) return "";
  const p = String(msg.platform || "").toLowerCase();
  if (!/^(twitch|youtube|kick|tiktok)$/.test(p)) return "";
  const labels = {
    twitch: "Twitch",
    youtube: "YouTube",
    kick: "Kick",
    tiktok: "TikTok"
  };
  const label = labels[p];
  return `<span class="ch-platform-pill ch-platform-pill-${p}">${escHtml(label)}</span>`;
}

function renderMessageHtml(msg) {
  const timeStr = config.showTimestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";

  return `<div class="ch-msg ${getHighlightClass(msg)}" data-id="${escHtml(
    msg.id
  )}" data-platform="${escHtml(msg.platform)}" data-time="${escHtml(timeStr)}">
    <div class="ch-msg-meta">
      ${platformTagHtml(msg)}
      ${msg.renderedBadges || ""}
      <span class="ch-username" style="color: ${usernameColor(msg)}">
        ${escHtml(msg.username)}
      </span>
      ${msg.pronouns ? `<span class="ch-pronouns">${escHtml(msg.pronouns)}</span>` : ""}
      <span class="ch-platform-dot ch-dot-${escHtml(msg.platform)}"></span>
    </div>
    <div class="ch-msg-body">${msg.renderedMessage || ""}</div>
  </div>`;
}

function getHighlightClass(msg) {
  if (msg.isFirstMessage) return "ch-msg-first";
  if (msg.type === "sub" || msg.type === "resub") return "ch-msg-sub";
  if (msg.type === "raid") return "ch-msg-raid";
  if (msg.type === "superchat" || msg.type === "donation") return "ch-msg-donation";
  return "";
}

function usernameColor(msg) {
  const chars = String(msg.username || "");
  if (!config.useUsernameColor) {
    const sum = chars.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return `hsl(${sum % 360}, 70%, 65%)`;
  }
  if (msg.usernameColor) return msg.usernameColor;
  const sum = chars.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `hsl(${sum % 360}, 70%, 65%)`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function startDemo() {
  if (demoTimer) {
    clearTimeout(demoTimer);
    demoTimer = null;
  }

  const messages = buildDemoMessages();
  messages.forEach((message, index) => {
    setTimeout(() => {
      Queue.add(message);
    }, index * 1200);
  });

  const cycleMs = messages.length * 1200 + 8000;
  demoTimer = setTimeout(() => {
    Queue.clear();
    startDemo();
  }, cycleMs);
}
