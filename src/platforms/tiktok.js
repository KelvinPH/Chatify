/**
 * TikTok LIVE chat via TikTool WebSocket (wss://api.tik.tools).
 * TikTok does not expose a public browser API; a free API key is required from https://tik.tools
 */

const WS_HOST = "wss://api.tik.tools";
const RECONNECT_DELAYS = [3000, 5000, 10000, 20000, 30000];

let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lastConfig = null;
let onMessageCallback = null;
let onEventCallback = null;

/**
 * Connect to TikTok LIVE chat for a streamer's username.
 * @param {{ uniqueId: string, apiKey: string, onMessage: Function, onEvent: Function }} opts
 */
export function connect({ uniqueId, apiKey, onMessage, onEvent }) {
  try {
    disconnect();

    const uid = String(uniqueId || "")
      .trim()
      .replace(/^@/, "");
    const key = String(apiKey || "").trim();

    if (!uid) {
      console.warn("TikTok connect skipped: missing uniqueId (TikTok username).");
      return;
    }
    if (!key) {
      console.warn("TikTok connect skipped: missing apiKey (get a free key at tik.tools).");
      return;
    }

    onMessageCallback = typeof onMessage === "function" ? onMessage : null;
    onEventCallback = typeof onEvent === "function" ? onEvent : null;
    lastConfig = { uniqueId: uid, apiKey: key, onMessage, onEvent };

    const qs = new URLSearchParams({ uniqueId: uid, apiKey: key });
    const wsUrl = `${WS_HOST}?${qs.toString()}`;
    socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      reconnectAttempts = 0;
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(typeof event.data === "string" ? event.data : "{}");
        const type = String(payload?.event || "").toLowerCase();
        let data = payload?.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch (_e) {
            data = {};
          }
        }
        if (!data || typeof data !== "object") data = {};

        if (type === "chat") {
          emitChat(data);
          return;
        }
        if (type === "subscribe") {
          emitSubscribe(data);
          return;
        }
        if (type === "gift") {
          emitGift(data);
          return;
        }
      } catch (err) {
        console.warn("TikTok message parse error.", err);
      }
    });

    socket.addEventListener("close", () => {
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      console.warn("TikTok WebSocket error.");
    });
  } catch (error) {
    console.warn("TikTok connect failed.", error);
  }
}

/** Close TikTok WebSocket and cancel reconnect. */
export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    try {
      socket.close();
    } catch (_e) {}
  }
  socket = null;
}

function mapTikTokBadges(user) {
  const raw = user?.badges;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const id = String(b?.type || b?.name || b?.badgeType || "badge").toLowerCase();
      const url =
        typeof b?.url === "string" && /^https?:\/\//i.test(b.url)
          ? b.url.trim()
          : typeof b?.image === "string" && /^https?:\/\//i.test(b.image)
            ? b.image.trim()
            : "";
      return { id, version: "1", url };
    })
    .filter((b) => b.id);
}

function emitChat(data) {
  if (!onMessageCallback) return;
  const user = data.user || {};
  const username = String(user.nickname || user.uniqueId || "viewer").trim() || "viewer";
  const comment = String(data.comment ?? data.text ?? "").trim();
  if (!comment) return;

  const badges = mapTikTokBadges(user);
  const uid = String(data.userId || user.uniqueId || username);

  onMessageCallback({
    id: `tiktok-${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    platform: "tiktok",
    username,
    usernameColor: "",
    message: comment,
    emotes: {},
    badges,
    isSubscriber: badges.some((b) => /sub|vip|fan/i.test(b.id)),
    isMod: badges.some((b) => /mod|admin|staff/i.test(b.id)),
    isVip: badges.some((b) => /vip/i.test(b.id)),
    isBroadcaster: false,
    isFirstMessage: false,
    bits: 0,
    timestamp: Date.now(),
    type: "message"
  });
}

function emitSubscribe(data) {
  if (!onEventCallback) return;
  const user = data.user || {};
  const username = String(user.nickname || user.uniqueId || "Someone").trim() || "Someone";

  onEventCallback({
    id: `tiktok-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform: "tiktok",
    username,
    usernameColor: "",
    message: "Subscribed on TikTok LIVE",
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
  });
}

function emitGift(data) {
  if (!onEventCallback) return;
  const user = data.user || {};
  const username = String(user.nickname || user.uniqueId || "Someone").trim() || "Someone";
  const giftName = String(data.giftName || "Gift");
  const repeat = Number(data.repeatCount) || 1;
  const diamonds = data.diamondCount != null ? String(data.diamondCount) : "";

  const parts = [`${giftName} ×${repeat}`];
  if (diamonds) parts.push(`${diamonds} coins`);

  onEventCallback({
    id: `tiktok-gift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform: "tiktok",
    username,
    usernameColor: "",
    message: parts.join(" · "),
    emotes: {},
    badges: [],
    isSubscriber: false,
    isMod: false,
    isVip: false,
    isBroadcaster: false,
    isFirstMessage: false,
    bits: 0,
    timestamp: Date.now(),
    type: "donation"
  });
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
