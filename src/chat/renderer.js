import * as TwitchPlatform from "../platforms/twitch.js";
import * as YouTubePlatform from "../platforms/youtube.js";
import * as KickPlatform from "../platforms/kick.js";
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
let layout = "floating";
let demoTimer = null;

/** Parse overlay URL parameters into normalized chat config. */
export function parseConfig() {
  const params = new URLSearchParams(window.location.search);
  const toBool = (v, fallback) => {
    if (v === null) return fallback;
    return v === "1" || v === "true";
  };

  return {
    platform: params.get("platform") || "twitch",
    channel: params.get("channel") || "",
    youtubeApiKey: params.get("youtubeApiKey") || "",
    youtubeChannelId: params.get("youtubeChannelId") || "",
    kickChannel: params.get("kickChannel") || "",
    theme: params.get("theme") || "obsidian",
    layout: params.get("layout") || "floating",
    maxMessages: Number(params.get("maxMessages")) || 50,
    showBadges: toBool(params.get("showBadges"), true),
    showPronouns: toBool(params.get("showPronouns"), false),
    showAvatars: toBool(params.get("showAvatars"), false),
    animateIn: params.get("animateIn") || "slide",
    animateOut: params.get("animateOut") || "fade",
    fontSize: Number(params.get("fontSize")) || 14,
    fontFamily: params.get("fontFamily") || "system",
    transparent: toBool(params.get("transparent"), false),
    demo: toBool(params.get("demo"), false)
  };
}

/** Initialize chat rendering pipeline and connect selected platform. */
export async function init() {
  config = parseConfig();
  layout = config.layout;

  document.documentElement.setAttribute("data-theme", config.theme);
  document.documentElement.style.setProperty("--ch-font-size", `${config.fontSize}px`);
  if (config.transparent) {
    document.body.style.background = "transparent";
  }

  Queue.init({
    max: config.maxMessages,
    onUpdate: renderMessages
  });

  const hasConfiguredChannel =
    Boolean(config.channel) || Boolean(config.youtubeChannelId) || Boolean(config.kickChannel);
  if (config.demo || !hasConfiguredChannel) {
    startDemo();
    return;
  }

  if (config.showPronouns) {
    await fetchPronounList();
  }

  await Promise.allSettled([BTTVEmotes.fetchGlobal(), SevenTVEmotes.fetchGlobal()]);

  if (config.platform === "twitch") {
    try {
      TwitchPlatform.connect({
        channel: config.channel,
        onMessage: (msg) => {
          try {
            handleMessage(msg);
          } catch (error) {
            console.warn("Twitch onMessage callback failed.", error);
          }
        },
        onEvent: (msg) => {
          try {
            handleEvent(msg);
          } catch (error) {
            console.warn("Twitch onEvent callback failed.", error);
          }
        }
      });
    } catch (error) {
      console.warn("Twitch platform connect failed.", error);
    }

    await Promise.allSettled([
      BTTVEmotes.fetchChannel(config.channel),
      FFZEmotes.fetchChannel(config.channel),
      SevenTVEmotes.fetchChannel(config.channel)
    ]);
  } else if (config.platform === "youtube") {
    try {
      YouTubePlatform.connect({
        channelId: config.youtubeChannelId,
        apiKey: config.youtubeApiKey,
        onMessage: (msg) => {
          try {
            handleMessage(msg);
          } catch (error) {
            console.warn("YouTube onMessage callback failed.", error);
          }
        },
        onEvent: (msg) => {
          try {
            handleEvent(msg);
          } catch (error) {
            console.warn("YouTube onEvent callback failed.", error);
          }
        }
      });
    } catch (error) {
      console.warn("YouTube platform connect failed.", error);
    }
  } else if (config.platform === "kick") {
    try {
      KickPlatform.connect({
        channel: config.kickChannel || config.channel,
        onMessage: (msg) => {
          try {
            handleMessage(msg);
          } catch (error) {
            console.warn("Kick onMessage callback failed.", error);
          }
        },
        onEvent: (msg) => {
          try {
            handleEvent(msg);
          } catch (error) {
            console.warn("Kick onEvent callback failed.", error);
          }
        }
      });
    } catch (error) {
      console.warn("Kick platform connect failed.", error);
    }
  }

  emoteMap = buildEmoteMap(BTTVEmotes.getEmotes(), FFZEmotes.getEmotes(), SevenTVEmotes.getEmotes());
  badgeData = TwitchBadges.getAll();

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
    const ordered = layout === "floating" ? messages : messages;
    app.innerHTML = ordered.map((msg) => renderMessageHtml(msg)).join("");
  } catch (error) {
    console.warn("renderMessages failed.", error);
  }
}

function renderMessageHtml(msg) {
  return `<div class="ch-msg ${getHighlightClass(msg)}" data-id="${escHtml(msg.id)}" data-platform="${escHtml(msg.platform)}">
    <div class="ch-msg-meta">
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
  if (msg.usernameColor) return msg.usernameColor;
  const chars = String(msg.username || "");
  const sum = chars.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = sum % 360;
  return `hsl(${hue}, 70%, 65%)`;
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
