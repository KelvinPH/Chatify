const PUSHER_KEY = "eb1d5f283081a78b932c";
const PUSHER_HOST = "ws-us2.pusher.com";
const PUSHER_PORT = 443;
const RECONNECT_DELAYS = [3000, 5000, 10000, 20000, 30000];

let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lastConfig = null;
let onMessageCallback = null;
let onEventCallback = null;
let pingInterval = null;
let channelId = null;

/** Connect to Kick chat through Pusher WebSocket. */
export async function connect({ channel, onMessage, onEvent }) {
  try {
    disconnect();

    const safeChannel = String(channel || "").trim();
    if (!safeChannel) {
      console.warn("Kick connect skipped: missing channel.");
      return;
    }

    onMessageCallback = typeof onMessage === "function" ? onMessage : null;
    onEventCallback = typeof onEvent === "function" ? onEvent : null;
    lastConfig = { channel: safeChannel, onMessage, onEvent };

    const KICK_API = `https://kick.com/api/v1/channels/${encodeURIComponent(safeChannel)}`;
    const CORS_PROXY = `https://nowify-workers.kelvinph.workers.dev/proxy?url=${
      encodeURIComponent(KICK_API)
    }`;

    let infoResponse = null;
    try {
      infoResponse = await fetch(KICK_API);
      if (!infoResponse.ok && infoResponse.type === "opaque") {
        throw new Error("CORS blocked");
      }
    } catch (_corsError) {
      console.warn("Kick direct fetch blocked, trying proxy...");
      try {
        infoResponse = await fetch(CORS_PROXY);
      } catch (proxyError) {
        console.warn("Kick proxy fetch also failed.", proxyError);
        return;
      }
    }

    if (!infoResponse || !infoResponse.ok) {
      if (infoResponse?.status === 404) {
        console.warn("Kick channel not found.");
        return;
      }
      console.warn("Kick channel lookup failed.", infoResponse?.status);
      return;
    }

    const channelData = await infoResponse.json();
    channelId = channelData?.id || null;
    if (!channelId) {
      console.warn("Kick channel ID missing from response.");
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
          data: { auth: "", channel: `chatroom.${channelId}` }
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

function parseKickMessage(data) {
  const sender = data?.sender || {};
  const badges = (sender?.identity?.badges || []).map((b) => ({
    id: b?.type || "",
    version: "1",
    url: b?.text || ""
  }));

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
