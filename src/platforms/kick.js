const PUSHER_KEY = "32cbd69e4b950bf97679";
const PUSHER_HOST = "ws-us2.pusher.com";
const PUSHER_PORT = 443;
const RECONNECT_DELAYS = [3000, 5000, 10000, 20000, 30000];

const CORS_PROXY_BASE = "https://nowify-workers.kelvinph.workers.dev/proxy?url=";

let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lastConfig = null;
let onMessageCallback = null;
let onEventCallback = null;
let pingInterval = null;

/** Connect to Kick chat through Pusher WebSocket. */
export async function connect({ channel, onMessage, onEvent }) {
  try {
    disconnect();

    const safeChannel = String(channel || "").trim().replace(/^#/, "");
    if (!safeChannel) {
      console.warn("Kick connect skipped: missing channel.");
      return;
    }

    onMessageCallback = typeof onMessage === "function" ? onMessage : null;
    onEventCallback = typeof onEvent === "function" ? onEvent : null;
    lastConfig = { channel: safeChannel, onMessage, onEvent };

    const channelPayload = await fetchKickChannel(safeChannel);
    if (!channelPayload) {
      console.warn("Kick channel lookup failed or blocked.");
      return;
    }

    const chatroomId = extractChatroomId(channelPayload);
    if (chatroomId == null) {
      console.warn("Kick chatroom id missing from API response.");
      return;
    }

    const wsUrl =
      `wss://${PUSHER_HOST}:${PUSHER_PORT}/app/${PUSHER_KEY}` +
      "?protocol=7&client=chatify&version=1.0&flash=false";
    socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: {
            auth: "",
            channel: `chatrooms.${chatroomId}.v2`
          }
        })
      );

      pingInterval = setInterval(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ event: "pusher:ping", data: {} }));
      }, 25000);

      reconnectAttempts = 0;
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(typeof event.data === "string" ? event.data : "{}");
        const eventType = payload?.event;
        const dataField = payload?.data;
        const eventData =
          typeof dataField === "string" ? JSON.parse(dataField || "{}") : dataField || {};

        if (eventType === "App\\Events\\ChatMessageEvent") {
          parseKickMessage(eventData);
          return;
        }

        if (eventType === "App\\Events\\SubscriptionEvent") {
          parseKickSub(eventData);
          return;
        }

        if (eventType === "App\\Events\\ChatroomClearEvent") {
          window.dispatchEvent(new CustomEvent("chatify:clear"));
          return;
        }

        if (eventType === "pusher:pong") {
          return;
        }
      } catch (error) {
        console.warn("Kick message parse error.", error);
      }
    });

    socket.addEventListener("close", () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      console.warn("Kick socket error.");
    });
  } catch (error) {
    console.warn("Kick connect failed.", error);
  }
}

/** Disconnect Kick chat socket and timers. */
export function disconnect() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
  }
  socket = null;
}

/**
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
async function fetchKickChannel(slug) {
  const enc = encodeURIComponent(slug);
  const urls = [
    `https://kick.com/api/v2/channels/${enc}`,
    `https://kick.com/api/v1/channels/${enc}`
  ];

  for (const url of urls) {
    const data = await tryFetchJson(url, false);
    if (data && !data.error) return data;
  }

  for (const url of urls) {
    const data = await tryFetchJson(url, true);
    if (data && !data.error) return data;
  }

  return null;
}

/**
 * @param {string} url
 * @param {boolean} useProxy
 */
async function tryFetchJson(url, useProxy) {
  const target = useProxy ? `${CORS_PROXY_BASE}${encodeURIComponent(url)}` : url;
  try {
    const res = await fetch(target, {
      credentials: "omit",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      return null;
    }
    try {
      return await res.json();
    } catch (_parse) {
      return null;
    }
  } catch (_e) {
    return null;
  }
}

function extractChatroomId(data) {
  const cr = data?.chatroom;
  if (cr != null && typeof cr === "object" && cr.id != null) {
    return Number(cr.id);
  }
  if (data?.chatroom_id != null) return Number(data.chatroom_id);
  return null;
}

/**
 * Kick sends badge `text` as a label (e.g. community name), not an image URL.
 * Only pass `url` through when it is a real http(s) URL so we don't render broken <img> icons.
 */
function pickKickBadgeImageUrl(b) {
  const candidates = [
    b?.image_url,
    b?.imageUrl,
    b?.icon_url,
    b?.iconUrl,
    b?.url,
    b?.src
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c.trim())) {
      return c.trim();
    }
  }
  return "";
}

function normalizeKickBadge(b) {
  const id = String(b?.type || "").toLowerCase();
  const url = pickKickBadgeImageUrl(b);
  const rawText = typeof b?.text === "string" ? b.text.trim() : "";
  const displayText =
    !url && rawText && !/^https?:\/\//i.test(rawText) ? rawText : "";
  return {
    id,
    version: "1",
    url,
    displayText
  };
}

function parseKickMessage(data) {
  const sender = data?.sender || {};
  const badges = (sender?.identity?.badges || []).map((b) => normalizeKickBadge(b));

  const normalized = {
    id: String(data?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    platform: "kick",
    username: sender?.username || "",
    usernameColor: sender?.identity?.color || "",
    message: data?.content || "",
    emotes: {},
    badges,
    isSubscriber: badges.some((b) => b.id === "subscriber"),
    isMod: badges.some((b) => b.id === "moderator"),
    isVip: badges.some((b) => b.id === "vip"),
    isBroadcaster: badges.some((b) => b.id === "broadcaster"),
    isFirstMessage: false,
    bits: 0,
    timestamp: Date.now(),
    type: "message"
  };

  if (onMessageCallback) {
    onMessageCallback(normalized);
  }
}

function parseKickSub(data) {
  const normalized = {
    id: String(data?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    platform: "kick",
    username: data?.username || "",
    usernameColor: "",
    message: `Subscribed for ${Number(data?.months || 0)} month(s)`,
    emotes: {},
    badges: [],
    isSubscriber: true,
    isMod: false,
    isVip: false,
    isBroadcaster: false,
    isFirstMessage: false,
    bits: 0,
    timestamp: Date.now(),
    type: "sub"
  };

  if (onEventCallback) {
    onEventCallback(normalized);
  }
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
