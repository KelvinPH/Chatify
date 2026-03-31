const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
const BADGES_API = "https://api.twitch.tv/helix/chat/badges/global";
const RECONNECT_DELAYS = [3000, 5000, 10000, 20000, 30000];

let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lastConfig = null;
let onMessageCallback = null;
let onEventCallback = null;
let channelBadges = {};
let globalBadges = {};

/** Connect to Twitch IRC chat for a channel. */
export function connect({ channel, onMessage, onEvent }) {
  try {
    disconnect();

    const safeChannel = String(channel || "").replace(/^#/, "").trim();
    if (!safeChannel) {
      console.warn("Twitch connect skipped: missing channel.");
      return;
    }

    onMessageCallback = typeof onMessage === "function" ? onMessage : null;
    onEventCallback = typeof onEvent === "function" ? onEvent : null;
    lastConfig = { channel: safeChannel, onMessage, onEvent };

    socket = new WebSocket(IRC_URL);

    socket.addEventListener("open", () => {
      if (!socket) return;
      socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      socket.send("NICK justinfan12345");
      socket.send(`JOIN #${safeChannel}`);
      reconnectAttempts = 0;
    });

    socket.addEventListener("message", (event) => {
      const payload = typeof event.data === "string" ? event.data : "";
      const lines = payload.split("\r\n").filter(Boolean);
      for (const line of lines) {
        parseIRCLine(line);
      }
    });

    socket.addEventListener("close", () => {
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      console.warn("Twitch IRC socket error.");
    });
  } catch (error) {
    console.warn("Twitch connect failed.", error);
  }
}

/** Disconnect Twitch IRC chat connection and timers. */
export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket) {
    socket.close();
  }

  socket = null;
}

function parseIRCLine(line) {
  if (!line) return;

  if (line.startsWith("PING")) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send("PONG :tmi.twitch.tv");
    }
    return;
  }

  const sourceMatch = line.match(/^(@([^ ]+) )?(?::([^ ]+) )?([^ ]+)(?: (.+))?$/);
  if (!sourceMatch) return;

  const tags = parseTags(sourceMatch[2] || "");
  const command = sourceMatch[4] || "";
  const params = sourceMatch[5] || "";

  if (command === "PRIVMSG") {
    const messageIndex = params.indexOf(" :");
    if (messageIndex === -1) return;

    const messageText = params.slice(messageIndex + 2);
    const sender = tags["display-name"] || (sourceMatch[3] || "").split("!")[0] || "";
    const badgeList = parseBadges(tags.badges || "", channelBadges, globalBadges);
    const bits = Number(tags.bits || 0) || 0;
    const normalized = {
      id: tags.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      platform: "twitch",
      username: sender,
      usernameColor: tags.color || "",
      message: messageText,
      emotes: parseEmotes(tags.emotes || ""),
      badges: badgeList,
      isSubscriber: badgeList.some((b) => b.id === "subscriber"),
      isMod: badgeList.some((b) => b.id === "moderator"),
      isVip: badgeList.some((b) => b.id === "vip"),
      isBroadcaster: badgeList.some((b) => b.id === "broadcaster"),
      isFirstMessage: tags["first-msg"] === "1",
      bits,
      timestamp: Date.now(),
      type: bits > 0 ? "donation" : "message"
    };

    if (onMessageCallback) {
      onMessageCallback(normalized);
    }
    return;
  }

  if (command === "USERNOTICE") {
    const msgId = tags["msg-id"] || "";
    let type = "";
    if (msgId === "sub" || msgId === "subgift") type = "sub";
    if (msgId === "resub") type = "resub";
    if (msgId === "raid") type = "raid";
    if (!type) return;

    const badgeList = parseBadges(tags.badges || "", channelBadges, globalBadges);
    const sender = tags["display-name"] || tags["login"] || "";
    const normalized = {
      id: tags.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      platform: "twitch",
      username: sender,
      usernameColor: tags.color || "",
      message: (tags["system-msg"] || "").replace(/\\s/g, " "),
      emotes: parseEmotes(tags.emotes || ""),
      badges: badgeList,
      isSubscriber: badgeList.some((b) => b.id === "subscriber"),
      isMod: badgeList.some((b) => b.id === "moderator"),
      isVip: badgeList.some((b) => b.id === "vip"),
      isBroadcaster: badgeList.some((b) => b.id === "broadcaster"),
      isFirstMessage: false,
      bits: 0,
      timestamp: Date.now(),
      type
    };

    if (onEventCallback) {
      onEventCallback(normalized);
    }
    return;
  }

  if (command === "CLEARMSG") {
    const targetMsgId = tags["target-msg-id"];
    if (!targetMsgId) return;
    window.dispatchEvent(
      new CustomEvent("chatify:delete", {
        detail: { id: targetMsgId }
      })
    );
    return;
  }

  if (command === "CLEARCHAT") {
    const usernameMatch = params.match(/ :([^ ]+)$/);
    window.dispatchEvent(
      new CustomEvent("chatify:timeout", {
        detail: { username: usernameMatch ? usernameMatch[1] : "" }
      })
    );
  }
}

function parseTags(rawTagString) {
  if (!rawTagString) return {};
  const result = {};
  const parts = rawTagString.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    result[key] = rest.join("=") || "";
  }
  return result;
}

function parseBadges(badgeString, channelBadgeMap, globalBadgeMap) {
  if (!badgeString) return [];

  return badgeString
    .split(",")
    .filter(Boolean)
    .map((badgeEntry) => {
      const [id, version] = badgeEntry.split("/");
      const channelVersion = channelBadgeMap?.[id]?.[version];
      const globalVersion = globalBadgeMap?.[id]?.[version];
      const url = channelVersion?.image_url_1x || globalVersion?.image_url_1x || "";
      return { id, version: version || "", url };
    });
}

function parseEmotes(emoteTag) {
  if (!emoteTag) return {};
  const emoteMap = {};
  const emoteParts = emoteTag.split("/");

  for (const part of emoteParts) {
    if (!part) continue;
    const [emoteId, rangeChunk] = part.split(":");
    if (!emoteId || !rangeChunk) continue;
    emoteMap[emoteId] = rangeChunk.split(",").filter(Boolean);
  }

  return emoteMap;
}

function scheduleReconnect() {
  if (!lastConfig) return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const index = Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1);
  const delay = Math.min(RECONNECT_DELAYS[index], 30000);
  reconnectAttempts += 1;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(lastConfig);
  }, delay);
}
